import { Router, type IRouter } from "express";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { db, usersTable, leaveRequestsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { composeName } from "../lib/names";
import { toApiUser } from "../lib/users";
import { getSettings } from "../lib/settings";
import {
  computeBalance,
  leaveYearOf,
  todayStr,
  ymdNum,
} from "../lib/leave";
import {
  GetMeResponse,
  UpdateMeBody,
  UpdateMeResponse,
  GetDashboardResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  res.json(GetMeResponse.parse(toApiUser(req.localUser!)));
});

router.patch("/me", requireAuth, async (req, res): Promise<void> => {
  const parsed = UpdateMeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const firstName = parsed.data.firstName.trim();
  const lastName = parsed.data.lastName.trim();
  if (!firstName || !lastName) {
    res.status(400).json({ error: "First name and surname are required" });
    return;
  }
  const name = composeName(firstName, lastName);
  const [updated] = await db
    .update(usersTable)
    .set({ firstName, lastName, name, nameManuallySet: true })
    .where(eq(usersTable.id, req.localUser!.id))
    .returning();
  res.json(UpdateMeResponse.parse(toApiUser(updated)));
});

router.get("/dashboard", requireAuth, async (req, res): Promise<void> => {
  const user = req.localUser!;
  const settings = await getSettings();
  const balance = await computeBalance(user, settings);
  const ly = leaveYearOf(todayStr(), settings);
  const today = todayStr();

  const approved = await db
    .select()
    .from(leaveRequestsTable)
    .where(
      and(
        eq(leaveRequestsTable.userId, user.id),
        eq(leaveRequestsTable.status, "approved"),
      ),
    );
  const nextApprovedLeave = approved
    .filter((r) => ymdNum(r.endDate) >= ymdNum(today))
    .sort((a, b) => ymdNum(a.startDate) - ymdNum(b.startDate))
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      type: r.type,
      startDate: r.startDate,
      endDate: r.endDate,
      workingDays: r.workingDays,
    }));

  res.json(
    GetDashboardResponse.parse({
      user: toApiUser(user),
      balance,
      nextApprovedLeave,
      sickOverAllowance: balance.sickUsed > user.sickEntitlement,
    }),
  );
});

export default router;
