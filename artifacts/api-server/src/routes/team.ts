import { Router, type IRouter } from "express";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, usersTable, calendarDaysTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { normalizeDateStr } from "../lib/leave";
import {
  GetTeamAvailabilityResponse,
  GetTeamMemberCalendarResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ---- Shared team availability (any authenticated member) ----
router.get("/team-availability", requireAuth, async (req, res): Promise<void> => {
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
  res.json(GetTeamAvailabilityResponse.parse(out));
});

// ---- A team member's calendar (query-only route to avoid path+query collision) ----
router.get("/team/user-calendar", requireAuth, async (req, res): Promise<void> => {
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
  res.json(GetTeamMemberCalendarResponse.parse(days));
});

export default router;
