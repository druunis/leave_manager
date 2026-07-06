import { and, eq, gte, lte, lt, inArray, ne } from "drizzle-orm";
import {
  db,
  leaveRequestsTable,
  calendarDaysTable,
  type Settings,
  type User,
} from "@workspace/db";

export type YMD = { y: number; m: number; d: number };

export function parseYMD(s: string): YMD {
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  return { y, m, d };
}

export function toYMD(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(
    d,
  ).padStart(2, "0")}`;
}

export function ymdNum(s: string): number {
  const { y, m, d } = parseYMD(s);
  return y * 10000 + m * 100 + d;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function todayStr(): string {
  const now = new Date();
  return toYMD(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
}

export function dateToYMD(d: Date): string {
  return toYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function normalizeDateStr(v: unknown): string | null {
  if (v instanceof Date) return dateToYMD(v);
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return dateToYMD(d);
  }
  return null;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function dayOfWeek(s: string): number {
  const { y, m, d } = parseYMD(s);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Sun .. 6 Sat
}

export function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  const s = parseYMD(start);
  let cur = new Date(Date.UTC(s.y, s.m - 1, s.d));
  const endNum = ymdNum(end);
  while (true) {
    const str = toYMD(
      cur.getUTCFullYear(),
      cur.getUTCMonth() + 1,
      cur.getUTCDate(),
    );
    if (ymdNum(str) > endNum) break;
    out.push(str);
    cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
  }
  return out;
}

export type LeaveYearWindow = {
  year: number;
  start: string;
  end: string;
  label: string;
};

export function leaveYearOf(
  dateStr: string,
  settings: Settings,
): LeaveYearWindow {
  const { y, m, d } = parseYMD(dateStr);
  const sm = settings.leaveYearStartMonth;
  const sd = settings.leaveYearStartDay;
  let startYear = y;
  if (m < sm || (m === sm && d < sd)) startYear = y - 1;
  const start = toYMD(startYear, sm, sd);
  const endObj = new Date(Date.UTC(startYear + 1, sm - 1, sd));
  endObj.setUTCDate(endObj.getUTCDate() - 1);
  const end = toYMD(
    endObj.getUTCFullYear(),
    endObj.getUTCMonth() + 1,
    endObj.getUTCDate(),
  );
  return {
    year: startYear,
    start,
    end,
    label: `${startYear}/${startYear + 1}`,
  };
}

// The leave year immediately preceding the given one.
function previousLeaveYear(
  ly: LeaveYearWindow,
  settings: Settings,
): LeaveYearWindow {
  const { y, m, d } = parseYMD(ly.start);
  const dayBefore = new Date(Date.UTC(y, m - 1, d));
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  return leaveYearOf(dateToYMD(dayBefore), settings);
}

// Sum of approved paid annual-leave days taken within a leave year.
async function usedPaidInYear(
  userId: number,
  ly: LeaveYearWindow,
): Promise<number> {
  const requests = await db
    .select()
    .from(leaveRequestsTable)
    .where(
      and(
        eq(leaveRequestsTable.userId, userId),
        eq(leaveRequestsTable.type, "annual"),
        eq(leaveRequestsTable.status, "approved"),
        gte(leaveRequestsTable.startDate, ly.start),
        lte(leaveRequestsTable.startDate, ly.end),
      ),
    );
  return requests.reduce((sum, r) => sum + r.paidDays, 0);
}

const MAX_CARRYOVER_DEPTH = 50;

// Days carried into leave year `ly` from the previous year's unused paid
// balance, capped at settings.maxRolloverDays. Excess is forfeited. Returns 0
// for years before the member started or when carry-over is disabled.
export async function computeCarryOver(
  user: User,
  settings: Settings,
  ly: LeaveYearWindow,
  depth = 0,
): Promise<number> {
  const cap = settings.maxRolloverDays ?? 0;
  if (cap <= 0) return 0;
  if (depth >= MAX_CARRYOVER_DEPTH) return 0;

  const prev = previousLeaveYear(ly, settings);
  const startLy = leaveYearOf(user.startDate, settings);
  // No carry-over into the member's first leave year (nothing precedes it).
  if (prev.year < startLy.year) return 0;

  // Previous year's true unused paid balance, fully accrued at year end.
  const accruedPrev = accruedAsOf(user, settings, prev.end, prev);
  const carriedIntoPrev = await computeCarryOver(user, settings, prev, depth + 1);
  const usedPaidPrev = await usedPaidInYear(user.id, prev);
  const unused =
    accruedPrev + carriedIntoPrev + user.balanceAdjustment - usedPaidPrev;

  return round2(Math.max(0, Math.min(unused, cap)));
}

// The date by which carried-over days must be used before they are forfeited:
// `carryOverDeadlineMonths` months after the leave-year start. Returns null when
// no deadline is configured (0 or less => carried days remain usable all year).
export function carryOverDeadline(
  settings: Settings,
  ly: LeaveYearWindow,
): string | null {
  const months = settings.carryOverDeadlineMonths ?? 0;
  if (months <= 0) return null;
  const { y, m, d } = parseYMD(ly.start);
  const monthIndex = m - 1 + months; // 0-based from Jan of the start year
  const year = y + Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  const day = Math.min(d, daysInMonth(year, month));
  return toYMD(year, month, day);
}

// Approved paid annual-leave days taken before `beforeStr` within a leave year.
async function usedPaidBeforeDate(
  userId: number,
  ly: LeaveYearWindow,
  beforeStr: string,
): Promise<number> {
  const requests = await db
    .select()
    .from(leaveRequestsTable)
    .where(
      and(
        eq(leaveRequestsTable.userId, userId),
        eq(leaveRequestsTable.type, "annual"),
        eq(leaveRequestsTable.status, "approved"),
        gte(leaveRequestsTable.startDate, ly.start),
        lt(leaveRequestsTable.startDate, beforeStr),
      ),
    );
  return requests.reduce((sum, r) => sum + r.paidDays, 0);
}

export type CarryOverState = {
  // Raw days carried into this leave year (capped, per computeCarryOver).
  carriedOver: number;
  // Days that still count toward the available balance as of `asOf`. Equal to
  // `carriedOver` before the deadline; on/after it, only the portion already
  // consumed survives (the unused remainder is forfeited).
  effective: number;
  // Days forfeited because they went unused past the deadline.
  forfeited: number;
  // The use-by deadline date, or null when no deadline is configured.
  deadline: string | null;
};

// Resolve how many carried-over days still count as of `asOfStr`, applying the
// configurable use-by deadline. Carried days are treated as consumed first, so
// only genuinely-unused carry-over is forfeited once the deadline passes.
export async function resolveCarryOver(
  user: User,
  settings: Settings,
  ly: LeaveYearWindow,
  asOfStr: string,
): Promise<CarryOverState> {
  const carriedOver = await computeCarryOver(user, settings, ly);
  const deadline = carryOverDeadline(settings, ly);
  if (carriedOver <= 0 || !deadline || ymdNum(asOfStr) < ymdNum(deadline)) {
    return { carriedOver, effective: carriedOver, forfeited: 0, deadline };
  }
  const usedBefore = await usedPaidBeforeDate(user.id, ly, deadline);
  const effective = round2(Math.max(0, Math.min(carriedOver, usedBefore)));
  return {
    carriedOver,
    effective,
    forfeited: round2(carriedOver - effective),
    deadline,
  };
}

// Accrued annual leave for a user as of a given date within a leave year.
export function accruedAsOf(
  user: User,
  settings: Settings,
  asOfStr: string,
  ly: LeaveYearWindow,
): number {
  const monthlyRate = user.annualEntitlement / 12;
  const sm = settings.leaveYearStartMonth;
  const startYear = ly.year;
  const startNum = ymdNum(user.startDate);
  const asOfNum = ymdNum(asOfStr);
  let accrued = 0;
  for (let i = 0; i < 12; i++) {
    const monthIndex = sm - 1 + i; // 0-based absolute from Jan of startYear
    const year = startYear + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    const accrualDay = Math.min(settings.accrualDay, daysInMonth(year, month));
    const eventStr = toYMD(year, month, accrualDay);
    const eventNum = ymdNum(eventStr);
    if (eventNum > asOfNum) break;
    if (startNum > eventNum) continue; // not employed at accrual time
    let factor = 1;
    const su = parseYMD(user.startDate);
    if (su.y === year && su.m === month && su.d > 1) {
      const dim = daysInMonth(year, month);
      factor = (dim - su.d + 1) / dim;
    }
    accrued += monthlyRate * factor;
  }
  return round2(Math.min(accrued, user.annualEntitlement));
}

const BOOKED = ["annual_pending", "annual_approved", "sick_pending", "sick_approved"];

// Count working days in a range that are available to be booked as leave.
export async function computeWorkingDays(
  userId: number,
  start: string,
  end: string,
  settings: Settings,
  excludeRequestId?: number,
): Promise<{ workingDays: number; dates: string[] }> {
  const range = eachDate(start, end);
  const existing = await db
    .select()
    .from(calendarDaysTable)
    .where(
      and(
        eq(calendarDaysTable.userId, userId),
        gte(calendarDaysTable.date, start),
        lte(calendarDaysTable.date, end),
      ),
    );
  const byDate = new Map(existing.map((c) => [c.date, c]));
  const dates: string[] = [];
  for (const day of range) {
    if (settings.autoWeekends) {
      const dow = dayOfWeek(day);
      if (dow === 0 || dow === 6) continue;
    }
    const rec = byDate.get(day);
    if (rec) {
      if (rec.status === "non_working") continue;
      if (
        BOOKED.includes(rec.status) &&
        rec.requestId != null &&
        rec.requestId !== excludeRequestId
      ) {
        continue; // already booked by another request
      }
    }
    dates.push(day);
  }
  return { workingDays: dates.length, dates };
}

export type PaidSplit = {
  workingDays: number;
  paidDays: number;
  unpaidDays: number;
  availableForPaid: number;
};

// Split working days into paid vs unpaid (salary-deducted) for an ANNUAL request.
export async function computeAnnualSplit(
  user: User,
  settings: Settings,
  endDate: string,
  workingDays: number,
  ly: LeaveYearWindow,
  excludeRequestId?: number,
): Promise<PaidSplit> {
  const accrued = accruedAsOf(user, settings, endDate, ly);
  const requests = await db
    .select()
    .from(leaveRequestsTable)
    .where(
      and(
        eq(leaveRequestsTable.userId, user.id),
        eq(leaveRequestsTable.type, "annual"),
        inArray(leaveRequestsTable.status, ["approved", "pending"]),
        gte(leaveRequestsTable.startDate, ly.start),
        lte(leaveRequestsTable.startDate, ly.end),
        excludeRequestId != null
          ? ne(leaveRequestsTable.id, excludeRequestId)
          : undefined,
      ),
    );
  const committedPaid = requests.reduce((sum, r) => sum + r.paidDays, 0);
  const { effective: carriedOver } = await resolveCarryOver(
    user,
    settings,
    ly,
    endDate,
  );
  const availableForPaid = round2(
    accrued + carriedOver + user.balanceAdjustment - committedPaid,
  );
  let paidDays = workingDays;
  let unpaidDays = 0;
  const canExceed = settings.allowExceedBalance;
  if (workingDays > Math.max(0, availableForPaid)) {
    if (canExceed && settings.excessBecomesUnpaid) {
      paidDays = Math.max(0, Math.min(workingDays, availableForPaid));
      unpaidDays = round2(workingDays - paidDays);
    } else if (canExceed && !settings.excessBecomesUnpaid) {
      paidDays = workingDays;
      unpaidDays = 0;
    } else {
      paidDays = Math.max(0, Math.min(workingDays, availableForPaid));
      unpaidDays = round2(workingDays - paidDays);
    }
  }
  return {
    workingDays,
    paidDays: round2(paidDays),
    unpaidDays,
    availableForPaid,
  };
}

export type Balance = {
  leaveYear: number;
  annualEntitlement: number;
  accrued: number;
  carriedOver: number;
  carryOverDeadline: string | null;
  usedPaid: number;
  usedUnpaid: number;
  available: number;
  pending: number;
  wouldBeUnpaid: number;
  sickUsed: number;
  sickRemaining: number;
  balanceAdjustment: number;
};

export async function computeBalance(
  user: User,
  settings: Settings,
  asOfStr?: string,
): Promise<Balance> {
  const asOf = asOfStr ?? todayStr();
  const ly = leaveYearOf(asOf, settings);
  const accrued = accruedAsOf(user, settings, asOf, ly);
  const requests = await db
    .select()
    .from(leaveRequestsTable)
    .where(
      and(
        eq(leaveRequestsTable.userId, user.id),
        gte(leaveRequestsTable.startDate, ly.start),
        lte(leaveRequestsTable.startDate, ly.end),
      ),
    );
  let usedPaid = 0;
  let usedUnpaid = 0;
  let pending = 0;
  let wouldBeUnpaid = 0;
  let sickUsed = 0;
  for (const r of requests) {
    if (r.type === "annual") {
      if (r.status === "approved") {
        usedPaid += r.paidDays;
        usedUnpaid += r.unpaidDays;
      } else if (r.status === "pending") {
        pending += r.workingDays;
        wouldBeUnpaid += r.unpaidDays;
      }
    } else if (r.type === "sick") {
      if (r.status === "approved") sickUsed += r.workingDays;
    }
  }
  const carry = await resolveCarryOver(user, settings, ly, asOf);
  const available = round2(
    accrued + carry.effective + user.balanceAdjustment - usedPaid,
  );
  return {
    leaveYear: ly.year,
    annualEntitlement: user.annualEntitlement,
    accrued,
    carriedOver: carry.carriedOver,
    carryOverDeadline: carry.deadline,
    usedPaid: round2(usedPaid),
    usedUnpaid: round2(usedUnpaid),
    available,
    pending: round2(pending),
    wouldBeUnpaid: round2(wouldBeUnpaid),
    sickUsed: round2(sickUsed),
    sickRemaining: round2(user.sickEntitlement - sickUsed),
    balanceAdjustment: user.balanceAdjustment,
  };
}
