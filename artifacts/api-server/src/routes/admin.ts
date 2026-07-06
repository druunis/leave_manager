import { Router, type IRouter } from "express";
import { and, eq, gte, lte, desc, inArray } from "drizzle-orm";
import {
  db,
  usersTable,
  leaveRequestsTable,
  calendarDaysTable,
  balanceAdjustmentsTable,
} from "@workspace/db";
import { requireAuth, requireAdmin } from "../lib/auth";
import { getSettings } from "../lib/settings";
import { composeName } from "../lib/names";
import {
  computeBalance,
  accruedAsOf,
  leaveYearOf,
  normalizeDateStr,
  todayStr,
  ymdNum,
  round2,
} from "../lib/leave";
import { notifyUser } from "../lib/notify";
import {
  AdminListUsersQueryParams,
  AdminListUsersResponse,
  AdminCreateUserBody,
  AdminCreateUserResponse,
  AdminGetUserParams,
  AdminGetUserResponse,
  AdminUpdateUserParams,
  AdminUpdateUserBody,
  AdminUpdateUserResponse,
  AdminDeleteUserParams,
  AdminDeactivateUserParams,
  AdminDeactivateUserResponse,
  AdminActivateUserParams,
  AdminActivateUserResponse,
  AdminOverrideBalanceParams,
  AdminOverrideBalanceBody,
  AdminOverrideBalanceResponse,
  AdminGetUserCalendarResponse,
  AdminListLeaveRequestsQueryParams,
  AdminListLeaveRequestsResponse,
  AdminApproveLeaveRequestParams,
  AdminApproveLeaveRequestBody,
  AdminApproveLeaveRequestResponse,
  AdminRejectLeaveRequestParams,
  AdminRejectLeaveRequestBody,
  AdminRejectLeaveRequestResponse,
  AdminGetTeamAvailabilityResponse,
  AdminGetReportQueryParams,
  AdminGetReportResponse,
  AdminGetUnpaidDeductionsQueryParams,
  AdminGetUnpaidDeductionsResponse,
  AdminGetOverviewResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.use(requireAuth, requireAdmin);

// ---- Users ----
router.get("/admin/users", async (req, res): Promise<void> => {
  const q = AdminListUsersQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const settings = await getSettings();
  const users = q.data.includeInactive
    ? await db.select().from(usersTable).orderBy(usersTable.name)
    : await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.active, true))
        .orderBy(usersTable.name);
  const out = [];
  for (const user of users) {
    const balance = await computeBalance(user, settings);
    out.push({ user, balance });
  }
  res.json(AdminListUsersResponse.parse(out));
});

router.post("/admin/users", async (req, res): Promise<void> => {
  const parsed = AdminCreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const settings = await getSettings();
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email));
  if (existing) {
    res.status(409).json({ error: "A user with that email already exists" });
    return;
  }
  const [created] = await db
    .insert(usersTable)
    .values({
      name: composeName(parsed.data.firstName, parsed.data.lastName),
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      // Admin explicitly named this user — outrank the Clerk sign-in sync.
      nameManuallySet: true,
      email: parsed.data.email,
      role: parsed.data.role ?? "user",
      startDate: normalizeDateStr(parsed.data.startDate)!,
      annualEntitlement:
        parsed.data.annualEntitlement ?? settings.annualEntitlement,
      sickEntitlement:
        parsed.data.sickEntitlement ?? settings.sickEntitlement,
    })
    .returning();
  res.status(201).json(AdminCreateUserResponse.parse(created));
});

router.get("/admin/users/:id", async (req, res): Promise<void> => {
  const params = AdminGetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const settings = await getSettings();
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, params.data.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const balance = await computeBalance(user, settings);
  res.json(AdminGetUserResponse.parse({ user, balance }));
});

router.patch("/admin/users/:id", async (req, res): Promise<void> => {
  const params = AdminUpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = AdminUpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const patch: Record<string, unknown> = {};
  if (parsed.data.firstName !== undefined) patch.firstName = parsed.data.firstName;
  if (parsed.data.lastName !== undefined) patch.lastName = parsed.data.lastName;
  if (parsed.data.firstName !== undefined || parsed.data.lastName !== undefined) {
    const [current] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, params.data.id));
    if (!current) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    patch.name = composeName(
      parsed.data.firstName ?? current.firstName,
      parsed.data.lastName ?? current.lastName,
    );
    // Admin explicitly set the name — outrank the Clerk sign-in sync.
    patch.nameManuallySet = true;
  }
  if (parsed.data.email !== undefined) patch.email = parsed.data.email;
  if (parsed.data.role !== undefined) patch.role = parsed.data.role;
  if (parsed.data.active !== undefined) patch.active = parsed.data.active;
  if (parsed.data.startDate !== undefined)
    patch.startDate = normalizeDateStr(parsed.data.startDate)!;
  if (parsed.data.annualEntitlement !== undefined)
    patch.annualEntitlement = parsed.data.annualEntitlement;
  if (parsed.data.sickEntitlement !== undefined)
    patch.sickEntitlement = parsed.data.sickEntitlement;
  const [updated] = await db
    .update(usersTable)
    .set(patch)
    .where(eq(usersTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(AdminUpdateUserResponse.parse(updated));
});

router.delete("/admin/users/:id", async (req, res): Promise<void> => {
  const params = AdminDeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (params.data.id === req.localUser!.id) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }
  await db
    .delete(calendarDaysTable)
    .where(eq(calendarDaysTable.userId, params.data.id));
  await db
    .delete(leaveRequestsTable)
    .where(eq(leaveRequestsTable.userId, params.data.id));
  const deleted = await db
    .delete(usersTable)
    .where(eq(usersTable.id, params.data.id))
    .returning();
  if (deleted.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/admin/users/:id/deactivate", async (req, res): Promise<void> => {
  const params = AdminDeactivateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set({ active: false })
    .where(eq(usersTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(AdminDeactivateUserResponse.parse(updated));
});

router.post("/admin/users/:id/activate", async (req, res): Promise<void> => {
  const params = AdminActivateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set({ active: true })
    .where(eq(usersTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(AdminActivateUserResponse.parse(updated));
});

router.post(
  "/admin/users/:id/override-balance",
  async (req, res): Promise<void> => {
    const params = AdminOverrideBalanceParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = AdminOverrideBalanceBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const settings = await getSettings();
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, params.data.id));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const [updated] = await db
      .update(usersTable)
      .set({
        balanceAdjustment: round2(
          user.balanceAdjustment + parsed.data.adjustment,
        ),
      })
      .where(eq(usersTable.id, user.id))
      .returning();
    await db.insert(balanceAdjustmentsTable).values({
      userId: user.id,
      adjustment: parsed.data.adjustment,
      note: parsed.data.note ?? null,
      createdBy: req.localUser!.id,
    });
    const balance = await computeBalance(updated, settings);
    await notifyUser(
      user.id,
      "balance_adjustment",
      "Balance adjusted",
      `An administrator adjusted your annual balance by ${parsed.data.adjustment} day(s).`,
    );
    res.json(AdminOverrideBalanceResponse.parse({ user: updated, balance }));
  },
);

// ---- User calendar (query-only route to avoid path+query collision) ----
router.get("/admin/user-calendar", async (req, res): Promise<void> => {
  const userId = Number(req.query.userId);
  const start = normalizeDateStr(req.query.start);
  const end = normalizeDateStr(req.query.end);
  if (!Number.isFinite(userId) || !start || !end) {
    res
      .status(400)
      .json({ error: "userId, start and end query params are required" });
    return;
  }
  const days = await db
    .select()
    .from(calendarDaysTable)
    .where(
      and(
        eq(calendarDaysTable.userId, userId),
        gte(calendarDaysTable.date, start),
        lte(calendarDaysTable.date, end),
      ),
    )
    .orderBy(calendarDaysTable.date);
  res.json(AdminGetUserCalendarResponse.parse(days));
});

// ---- Leave requests review ----
router.get("/admin/leave-requests", async (req, res): Promise<void> => {
  const q = AdminListLeaveRequestsQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const settings = await getSettings();
  const conds = [];
  if (q.data.status) conds.push(eq(leaveRequestsTable.status, q.data.status));
  if (q.data.type) conds.push(eq(leaveRequestsTable.type, q.data.type));
  if (q.data.userId) conds.push(eq(leaveRequestsTable.userId, q.data.userId));
  const requests = await db
    .select()
    .from(leaveRequestsTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(leaveRequestsTable.createdAt));

  const users = await db.select().from(usersTable);
  const userMap = new Map(users.map((u) => [u.id, u]));

  const out = [];
  for (const request of requests) {
    const user = userMap.get(request.userId);
    if (!user) continue;
    const ly = leaveYearOf(request.endDate, settings);
    const balance = await computeBalance(user, settings, request.endDate);
    out.push({
      request,
      userName: user.name,
      userEmail: user.email,
      accruedAtDate: accruedAsOf(user, settings, request.endDate, ly),
      usedAnnual: round2(balance.usedPaid + balance.usedUnpaid),
      sickUsed: balance.sickUsed,
      sickOverAllowance: balance.sickUsed > user.sickEntitlement,
    });
  }
  res.json(AdminListLeaveRequestsResponse.parse(out));
});

router.post(
  "/admin/leave-requests/:id/approve",
  async (req, res): Promise<void> => {
    const params = AdminApproveLeaveRequestParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = AdminApproveLeaveRequestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [request] = await db
      .select()
      .from(leaveRequestsTable)
      .where(eq(leaveRequestsTable.id, params.data.id));
    if (!request) {
      res.status(404).json({ error: "Leave request not found" });
      return;
    }
    if (request.status !== "pending") {
      res.status(400).json({ error: "Only pending requests can be approved" });
      return;
    }
    const [updated] = await db
      .update(leaveRequestsTable)
      .set({
        status: "approved",
        adminNote: parsed.data.adminNote ?? null,
        approvedBy: req.localUser!.id,
        approvedAt: new Date(),
      })
      .where(eq(leaveRequestsTable.id, request.id))
      .returning();
    const approvedStatus =
      request.type === "annual" ? "annual_approved" : "sick_approved";
    await db
      .update(calendarDaysTable)
      .set({ status: approvedStatus })
      .where(eq(calendarDaysTable.requestId, request.id));
    await notifyUser(
      request.userId,
      "leave_approved",
      "Leave approved",
      `Your ${request.type} leave (${request.startDate} to ${request.endDate}) was approved.`,
      request.id,
    );
    res.json(AdminApproveLeaveRequestResponse.parse(updated));
  },
);

router.post(
  "/admin/leave-requests/:id/reject",
  async (req, res): Promise<void> => {
    const params = AdminRejectLeaveRequestParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = AdminRejectLeaveRequestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [request] = await db
      .select()
      .from(leaveRequestsTable)
      .where(eq(leaveRequestsTable.id, params.data.id));
    if (!request) {
      res.status(404).json({ error: "Leave request not found" });
      return;
    }
    if (request.status !== "pending") {
      res.status(400).json({ error: "Only pending requests can be rejected" });
      return;
    }
    const [updated] = await db
      .update(leaveRequestsTable)
      .set({
        status: "rejected",
        adminNote: parsed.data.adminNote ?? null,
        rejectedBy: req.localUser!.id,
        rejectedAt: new Date(),
      })
      .where(eq(leaveRequestsTable.id, request.id))
      .returning();
    await db
      .delete(calendarDaysTable)
      .where(eq(calendarDaysTable.requestId, request.id));
    await notifyUser(
      request.userId,
      "leave_rejected",
      "Leave rejected",
      `Your ${request.type} leave (${request.startDate} to ${request.endDate}) was rejected.`,
      request.id,
    );
    res.json(AdminRejectLeaveRequestResponse.parse(updated));
  },
);

// ---- Team availability ----
router.get("/admin/team-availability", async (req, res): Promise<void> => {
  const start = normalizeDateStr(req.query.start);
  const end = normalizeDateStr(req.query.end);
  if (!start || !end) {
    res.status(400).json({ error: "start and end query params are required" });
    return;
  }
  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.active, true))
    .orderBy(usersTable.name);
  const out = [];
  for (const user of users) {
    const days = await db
      .select()
      .from(calendarDaysTable)
      .where(
        and(
          eq(calendarDaysTable.userId, user.id),
          gte(calendarDaysTable.date, start),
          lte(calendarDaysTable.date, end),
        ),
      )
      .orderBy(calendarDaysTable.date);
    out.push({ userId: user.id, userName: user.name, days });
  }
  res.json(AdminGetTeamAvailabilityResponse.parse(out));
});

// ---- Reports ----
router.get("/admin/report", async (req, res): Promise<void> => {
  const q = AdminGetReportQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const settings = await getSettings();
  const users = await db
    .select()
    .from(usersTable)
    .orderBy(usersTable.name);
  const targetYear = q.data.leaveYear;
  const { start, end, type, status } = q.data;
  const out = [];
  for (const user of users) {
    if (q.data.userId && user.id !== q.data.userId) continue;
    const asOf =
      targetYear != null
        ? `${targetYear}-${String(settings.leaveYearStartMonth).padStart(2, "0")}-${String(settings.leaveYearStartDay).padStart(2, "0")}`
        : todayStr();
    const ly = leaveYearOf(asOf, settings);
    const balance = await computeBalance(user, settings, ly.end);
    // Date window: explicit start/end filters override the leave-year window.
    const windowStart = normalizeDateStr(start) ?? ly.start;
    const windowEnd = normalizeDateStr(end) ?? ly.end;
    const conditions = [
      eq(leaveRequestsTable.userId, user.id),
      gte(leaveRequestsTable.startDate, windowStart),
      lte(leaveRequestsTable.startDate, windowEnd),
    ];
    if (type) conditions.push(eq(leaveRequestsTable.type, type));
    if (status) conditions.push(eq(leaveRequestsTable.status, status));
    const reqs = await db
      .select()
      .from(leaveRequestsTable)
      .where(and(...conditions));
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    for (const r of reqs) {
      if (r.status === "pending") pendingCount++;
      else if (r.status === "approved") approvedCount++;
      else if (r.status === "rejected") rejectedCount++;
    }
    out.push({
      userId: user.id,
      userName: user.name,
      leaveYear: ly.year,
      startDate: user.startDate,
      annualEntitlement: user.annualEntitlement,
      accrued: balance.accrued,
      usedPaid: balance.usedPaid,
      usedUnpaid: balance.usedUnpaid,
      sickUsed: balance.sickUsed,
      sickRemaining: balance.sickRemaining,
      pendingCount,
      approvedCount,
      rejectedCount,
    });
  }
  res.json(AdminGetReportResponse.parse(out));
});

router.get("/admin/unpaid-deductions", async (req, res): Promise<void> => {
  const q = AdminGetUnpaidDeductionsQueryParams.safeParse(req.query);
  if (!q.success) {
    res.status(400).json({ error: q.error.message });
    return;
  }
  const settings = await getSettings();
  const asOf =
    q.data.leaveYear != null
      ? `${q.data.leaveYear}-${String(settings.leaveYearStartMonth).padStart(2, "0")}-${String(settings.leaveYearStartDay).padStart(2, "0")}`
      : todayStr();
  const ly = leaveYearOf(asOf, settings);
  const rows = await db
    .select()
    .from(leaveRequestsTable)
    .where(
      and(
        eq(leaveRequestsTable.type, "annual"),
        eq(leaveRequestsTable.status, "approved"),
        gte(leaveRequestsTable.startDate, ly.start),
        lte(leaveRequestsTable.startDate, ly.end),
      ),
    );
  const users = await db.select().from(usersTable);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const out = rows
    .filter((r) => r.unpaidDays > 0)
    .map((r) => ({
      userId: r.userId,
      userName: userMap.get(r.userId)?.name ?? "Unknown",
      requestId: r.id,
      startDate: r.startDate,
      endDate: r.endDate,
      unpaidDays: r.unpaidDays,
    }));
  res.json(AdminGetUnpaidDeductionsResponse.parse(out));
});

// ---- Overview ----
router.get("/admin/overview", async (_req, res): Promise<void> => {
  const settings = await getSettings();
  const users = await db.select().from(usersTable);
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.active).length;
  const pending = await db
    .select()
    .from(leaveRequestsTable)
    .where(eq(leaveRequestsTable.status, "pending"));
  const today = todayStr();
  const onLeave = await db
    .select()
    .from(calendarDaysTable)
    .where(
      and(
        eq(calendarDaysTable.date, today),
        inArray(calendarDaysTable.status, [
          "annual_approved",
          "sick_approved",
        ]),
      ),
    );
  const ly = leaveYearOf(today, settings);
  const approvedAnnual = await db
    .select()
    .from(leaveRequestsTable)
    .where(
      and(
        eq(leaveRequestsTable.type, "annual"),
        eq(leaveRequestsTable.status, "approved"),
        gte(leaveRequestsTable.startDate, ly.start),
        lte(leaveRequestsTable.startDate, ly.end),
      ),
    );
  const totalUnpaidDays = round2(
    approvedAnnual.reduce((sum, r) => sum + r.unpaidDays, 0),
  );
  res.json(
    AdminGetOverviewResponse.parse({
      totalUsers,
      activeUsers,
      pendingRequests: pending.length,
      onLeaveToday: onLeave.length,
      totalUnpaidDays,
    }),
  );
});

export default router;
