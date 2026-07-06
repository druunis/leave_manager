import { Router, type IRouter } from "express";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db, calendarDaysTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { normalizeDateStr } from "../lib/leave";
import { MarkCalendarDaysBody, GetCalendarResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/calendar", requireAuth, async (req, res): Promise<void> => {
  const start = normalizeDateStr(req.query.start);
  const end = normalizeDateStr(req.query.end);
  if (!start || !end) {
    res.status(400).json({ error: "start and end query params are required" });
    return;
  }
  const days = await db
    .select()
    .from(calendarDaysTable)
    .where(
      and(
        eq(calendarDaysTable.userId, req.localUser!.id),
        gte(calendarDaysTable.date, start),
        lte(calendarDaysTable.date, end),
      ),
    )
    .orderBy(calendarDaysTable.date);
  res.json(GetCalendarResponse.parse(days));
});

router.post("/calendar/mark", requireAuth, async (req, res): Promise<void> => {
  const parsed = MarkCalendarDaysBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { dates, status, note } = parsed.data;
  if (status !== "working" && status !== "non_working") {
    res
      .status(400)
      .json({ error: "Only working or non_working may be set manually" });
    return;
  }
  const dateStrs = dates
    .map((d) => normalizeDateStr(d))
    .filter((d): d is string => d !== null);
  const userId = req.localUser!.id;
  const results = [];
  for (const date of dateStrs) {
    const [row] = await db
      .insert(calendarDaysTable)
      .values({ userId, date, status, note: note ?? null })
      .onConflictDoUpdate({
        target: [calendarDaysTable.userId, calendarDaysTable.date],
        set: { status, note: note ?? null, requestId: null },
      })
      .returning();
    results.push(row);
  }
  res.json(GetCalendarResponse.parse(results));
});

export default router;
