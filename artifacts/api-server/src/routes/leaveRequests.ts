import { Router, type IRouter } from "express";
import { and, eq, desc } from "drizzle-orm";
import {
  db,
  leaveRequestsTable,
  calendarDaysTable,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { getSettings } from "../lib/settings";
import {
  computeWorkingDays,
  computeAnnualSplit,
  computeBalance,
  leaveYearOf,
  normalizeDateStr,
  ymdNum,
} from "../lib/leave";
import { notifyAdmins } from "../lib/notify";
import {
  ListMyLeaveRequestsQueryParams,
  ListMyLeaveRequestsResponse,
  CreateLeaveRequestBody,
  CreateLeaveRequestResponse,
  PreviewLeaveRequestBody,
  PreviewLeaveRequestResponse,
  CancelLeaveRequestParams,
  CancelLeaveRequestResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/leave-requests", requireAuth, async (req, res): Promise<void> => {
  const q = ListMyLeaveRequestsQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const conds = [eq(leaveRequestsTable.userId, req.localUser!.id)];
  if (q.data.status) conds.push(eq(leaveRequestsTable.status, q.data.status));
  if (q.data.type) conds.push(eq(leaveRequestsTable.type, q.data.type));
  const rows = await db
    .select()
    .from(leaveRequestsTable)
    .where(and(...conds))
    .orderBy(desc(leaveRequestsTable.startDate));
  res.json(ListMyLeaveRequestsResponse.parse(rows));
});

router.post(
  "/leave-requests/preview",
  requireAuth,
  async (req, res): Promise<void> => {
    const parsed = PreviewLeaveRequestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const user = req.localUser!;
    const settings = await getSettings();
    const start = normalizeDateStr(parsed.data.startDate)!;
    const end = normalizeDateStr(parsed.data.endDate)!;
    if (ymdNum(end) < ymdNum(start)) {
      res.status(400).json({ error: "endDate must be on or after startDate" });
      return;
    }
    if (leaveYearOf(start, settings).year !== leaveYearOf(end, settings).year) {
      res.status(400).json({
        error:
          "A request cannot span two leave years. Please submit separate requests for each leave year.",
      });
      return;
    }
    const { workingDays } = await computeWorkingDays(
      user.id,
      start,
      end,
      settings,
    );
    if (parsed.data.type === "sick") {
      const balance = await computeBalance(user, settings, end);
      const sickOverAllowance =
        balance.sickUsed + workingDays > user.sickEntitlement;
      res.json(
        PreviewLeaveRequestResponse.parse({
          workingDays,
          paidDays: workingDays,
          unpaidDays: 0,
          hasUnpaid: false,
          availableBeforeRequest: balance.sickRemaining,
          sickOverAllowance,
        }),
      );
      return;
    }
    const ly = leaveYearOf(end, settings);
    const split = await computeAnnualSplit(
      user,
      settings,
      end,
      workingDays,
      ly,
    );
    res.json(
      PreviewLeaveRequestResponse.parse({
        workingDays: split.workingDays,
        paidDays: split.paidDays,
        unpaidDays: split.unpaidDays,
        hasUnpaid: split.unpaidDays > 0,
        availableBeforeRequest: split.availableForPaid,
        sickOverAllowance: false,
      }),
    );
  },
);

router.post("/leave-requests", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateLeaveRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = req.localUser!;
  const settings = await getSettings();
  const start = normalizeDateStr(parsed.data.startDate)!;
  const end = normalizeDateStr(parsed.data.endDate)!;
  if (ymdNum(end) < ymdNum(start)) {
    res.status(400).json({ error: "endDate must be on or after startDate" });
    return;
  }
  if (leaveYearOf(start, settings).year !== leaveYearOf(end, settings).year) {
    res.status(400).json({
      error:
        "A request cannot span two leave years. Please submit separate requests for each leave year.",
    });
    return;
  }
  const { workingDays, dates } = await computeWorkingDays(
    user.id,
    start,
    end,
    settings,
  );
  if (workingDays === 0) {
    res
      .status(400)
      .json({ error: "No available working days in the selected range" });
    return;
  }

  let paidDays = workingDays;
  let unpaidDays = 0;
  if (parsed.data.type === "annual") {
    const ly = leaveYearOf(end, settings);
    const split = await computeAnnualSplit(user, settings, end, workingDays, ly);
    paidDays = split.paidDays;
    unpaidDays = split.unpaidDays;
    if (unpaidDays > 0 && !settings.allowExceedBalance) {
      res.status(400).json({
        error: "Request exceeds your available balance and is not permitted",
      });
      return;
    }
  }

  const [request] = await db
    .insert(leaveRequestsTable)
    .values({
      userId: user.id,
      type: parsed.data.type,
      startDate: start,
      endDate: end,
      workingDays,
      paidDays,
      unpaidDays,
      status: "pending",
      userNote: parsed.data.userNote ?? null,
    })
    .returning();

  const pendingStatus =
    parsed.data.type === "annual" ? "annual_pending" : "sick_pending";
  for (const date of dates) {
    await db
      .insert(calendarDaysTable)
      .values({
        userId: user.id,
        date,
        status: pendingStatus,
        requestId: request.id,
      })
      .onConflictDoUpdate({
        target: [calendarDaysTable.userId, calendarDaysTable.date],
        set: { status: pendingStatus, requestId: request.id },
      });
  }

  await notifyAdmins(
    "leave_request",
    "New leave request",
    `${user.name} requested ${parsed.data.type} leave for ${workingDays} day(s) (${start} to ${end}).`,
    request.id,
  );

  res.status(201).json(CreateLeaveRequestResponse.parse(request));
});

router.post(
  "/leave-requests/:id/cancel",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = CancelLeaveRequestParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [request] = await db
      .select()
      .from(leaveRequestsTable)
      .where(
        and(
          eq(leaveRequestsTable.id, params.data.id),
          eq(leaveRequestsTable.userId, req.localUser!.id),
        ),
      );
    if (!request) {
      res.status(404).json({ error: "Leave request not found" });
      return;
    }
    if (request.status !== "pending") {
      res
        .status(400)
        .json({ error: "Only pending requests can be cancelled" });
      return;
    }
    const [updated] = await db
      .update(leaveRequestsTable)
      .set({ status: "cancelled" })
      .where(eq(leaveRequestsTable.id, request.id))
      .returning();
    await db
      .delete(calendarDaysTable)
      .where(eq(calendarDaysTable.requestId, request.id));
    res.json(CancelLeaveRequestResponse.parse(updated));
  },
);

export default router;
