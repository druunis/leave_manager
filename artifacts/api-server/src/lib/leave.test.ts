import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Settings, User } from "@workspace/db";

// ---------------------------------------------------------------------------
// Mocks
//
// leave.ts talks to Postgres via drizzle. To keep these as fast, deterministic
// unit tests of the *calculation* logic, we replace:
//   - `@workspace/db`  -> an in-memory `db` whose `select().from(table).where()`
//                         resolves to rows we control per-table.
//   - `drizzle-orm`    -> no-op condition builders (their results are ignored by
//                         the mocked `.where()`), so no real SQL is constructed.
// ---------------------------------------------------------------------------
const mockState = vi.hoisted(() => ({
  calendarRows: [] as unknown[],
  leaveRows: [] as unknown[],
}));

vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => a,
  eq: (...a: unknown[]) => a,
  gte: (...a: unknown[]) => a,
  lte: (...a: unknown[]) => a,
  lt: (...a: unknown[]) => a,
  inArray: (...a: unknown[]) => a,
  ne: (...a: unknown[]) => a,
}));

vi.mock("@workspace/db", () => {
  const calendarDaysTable = { _t: "calendar_days" };
  const leaveRequestsTable = { _t: "leave_requests" };
  return {
    calendarDaysTable,
    leaveRequestsTable,
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: () =>
            Promise.resolve(
              table === calendarDaysTable
                ? mockState.calendarRows
                : mockState.leaveRows,
            ),
        }),
      }),
    },
  };
});

import {
  leaveYearOf,
  accruedAsOf,
  computeWorkingDays,
  computeAnnualSplit,
  computeBalance,
  carryOverDeadline,
} from "./leave";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Leave year: 1 October -> 30 September. Accrual on the 28th of each month.
function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    id: 1,
    annualEntitlement: 24,
    sickEntitlement: 10,
    leaveYearStartMonth: 10,
    leaveYearStartDay: 1,
    accrualDay: 28,
    maxRolloverDays: 0,
    carryOverDeadlineMonths: 0,
    allowExceedBalance: true,
    excessBecomesUnpaid: true,
    autoWeekends: true,
    allowHalfDays: false,
    updatedAt: new Date(),
    ...overrides,
  } as Settings;
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    clerkUserId: "clerk_1",
    name: "Test User",
    email: "test@example.com",
    role: "user",
    startDate: "2020-01-01", // employed well before any leave year under test
    active: true,
    annualEntitlement: 24,
    sickEntitlement: 10,
    balanceAdjustment: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User;
}

beforeEach(() => {
  mockState.calendarRows = [];
  mockState.leaveRows = [];
});

// ---------------------------------------------------------------------------
// leaveYearOf — the Sep 30 / Oct 1 boundary
// ---------------------------------------------------------------------------
describe("leaveYearOf (Oct 1 boundary)", () => {
  const settings = makeSettings();

  it("Oct 1 opens the new leave year", () => {
    const ly = leaveYearOf("2025-10-01", settings);
    expect(ly.year).toBe(2025);
    expect(ly.start).toBe("2025-10-01");
    expect(ly.end).toBe("2026-09-30");
    expect(ly.label).toBe("2025/2026");
  });

  it("Sep 30 still belongs to the previous leave year", () => {
    const ly = leaveYearOf("2025-09-30", settings);
    expect(ly.year).toBe(2024);
    expect(ly.start).toBe("2024-10-01");
    expect(ly.end).toBe("2025-09-30");
    expect(ly.label).toBe("2024/2025");
  });

  it("a date mid-year maps to the year that started the previous Oct 1", () => {
    const ly = leaveYearOf("2026-01-15", settings);
    expect(ly.year).toBe(2025);
    expect(ly.start).toBe("2025-10-01");
    expect(ly.end).toBe("2026-09-30");
  });

  it("honours a non-default start (e.g. Jan 1 calendar year)", () => {
    const jan = makeSettings({ leaveYearStartMonth: 1, leaveYearStartDay: 1 });
    const ly = leaveYearOf("2025-06-15", jan);
    expect(ly.year).toBe(2025);
    expect(ly.start).toBe("2025-01-01");
    expect(ly.end).toBe("2025-12-31");
  });
});

// ---------------------------------------------------------------------------
// accruedAsOf — monthly accrual, proration, capping
// ---------------------------------------------------------------------------
describe("accruedAsOf", () => {
  const settings = makeSettings(); // accrualDay 28, entitlement 24 => 2/month
  const ly = leaveYearOf("2026-01-01", settings); // 2025-10-01 .. 2026-09-30

  it("accrues nothing the day before the first accrual event", () => {
    const user = makeUser();
    expect(accruedAsOf(user, settings, "2025-10-27", ly)).toBe(0);
  });

  it("accrues one month on the 28th (accrual lands on the 28th)", () => {
    const user = makeUser();
    expect(accruedAsOf(user, settings, "2025-10-28", ly)).toBe(2);
  });

  it("accrues the full entitlement by the end of the leave year", () => {
    const user = makeUser();
    expect(accruedAsOf(user, settings, "2026-09-30", ly)).toBe(24);
  });

  it("never exceeds the annual entitlement (capped)", () => {
    // Rate higher than 12 months of entitlement would still cap at entitlement.
    const user = makeUser({ annualEntitlement: 12 });
    const s = makeSettings({ annualEntitlement: 12 });
    const y = leaveYearOf("2026-01-01", s);
    expect(accruedAsOf(user, s, "2026-09-30", y)).toBe(12);
  });

  it("prorates a mid-month starter for their first accrual", () => {
    // Starts 15 Oct 2025; Oct has 31 days => factor (31-15+1)/31 = 17/31.
    // monthlyRate 2 => 2 * 17/31 = 1.0968 -> 1.10
    const user = makeUser({ startDate: "2025-10-15" });
    expect(accruedAsOf(user, settings, "2025-10-28", ly)).toBe(1.1);
  });

  it("skips accrual months that occur before the employee started", () => {
    // Starts 1 Nov 2025: misses the Oct 28 event, earns full months after.
    const user = makeUser({ startDate: "2025-11-01" });
    // As of 28 Nov 2025 only the Nov event has fired => 2 days, no Oct.
    expect(accruedAsOf(user, settings, "2025-11-28", ly)).toBe(2);
  });

  it("clamps the accrual day to the last day of a short month", () => {
    // accrualDay 31, leave year starts 1 Feb 2026 (non-leap): Feb has 28 days,
    // so the first event is 28 Feb 2026, not the 31st.
    const s = makeSettings({
      leaveYearStartMonth: 2,
      leaveYearStartDay: 1,
      accrualDay: 31,
    });
    const user = makeUser();
    const y = leaveYearOf("2026-06-01", s); // 2026-02-01 .. 2027-01-31
    expect(accruedAsOf(user, s, "2026-02-27", y)).toBe(0);
    expect(accruedAsOf(user, s, "2026-02-28", y)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// computeWorkingDays — weekend & non-working exclusion, double-booking
// ---------------------------------------------------------------------------
describe("computeWorkingDays", () => {
  // 2024-01-01 is a Monday; 2024-01-07 is a Sunday.
  it("excludes weekends when autoWeekends is on", async () => {
    const settings = makeSettings({ autoWeekends: true });
    const { workingDays, dates } = await computeWorkingDays(
      1,
      "2024-01-01",
      "2024-01-07",
      settings,
    );
    expect(workingDays).toBe(5);
    expect(dates).toEqual([
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
      "2024-01-04",
      "2024-01-05",
    ]);
  });

  it("includes weekends when autoWeekends is off", async () => {
    const settings = makeSettings({ autoWeekends: false });
    const { workingDays } = await computeWorkingDays(
      1,
      "2024-01-01",
      "2024-01-07",
      settings,
    );
    expect(workingDays).toBe(7);
  });

  it("excludes days flagged non_working in the calendar", async () => {
    const settings = makeSettings({ autoWeekends: true });
    mockState.calendarRows = [
      { date: "2024-01-03", status: "non_working", requestId: null },
    ];
    const { workingDays, dates } = await computeWorkingDays(
      1,
      "2024-01-01",
      "2024-01-05",
      settings,
    );
    expect(workingDays).toBe(4);
    expect(dates).not.toContain("2024-01-03");
  });

  it("excludes days already booked by another request", async () => {
    const settings = makeSettings({ autoWeekends: true });
    mockState.calendarRows = [
      { date: "2024-01-02", status: "annual_approved", requestId: 99 },
    ];
    const { workingDays } = await computeWorkingDays(
      1,
      "2024-01-01",
      "2024-01-05",
      settings,
    );
    expect(workingDays).toBe(4);
  });

  it("re-includes a day booked by the request being edited (excludeRequestId)", async () => {
    const settings = makeSettings({ autoWeekends: true });
    mockState.calendarRows = [
      { date: "2024-01-02", status: "annual_approved", requestId: 99 },
    ];
    const { workingDays } = await computeWorkingDays(
      1,
      "2024-01-01",
      "2024-01-05",
      settings,
      99,
    );
    expect(workingDays).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// computeAnnualSplit — paid vs unpaid when the balance is exceeded
// ---------------------------------------------------------------------------
describe("computeAnnualSplit", () => {
  const ly = leaveYearOf("2026-01-01", makeSettings());
  const endDate = "2026-09-30"; // full year accrued => 24 available

  it("keeps everything paid when within the available balance", async () => {
    const settings = makeSettings();
    const split = await computeAnnualSplit(
      makeUser(),
      settings,
      endDate,
      10,
      ly,
    );
    expect(split.availableForPaid).toBe(24);
    expect(split.paidDays).toBe(10);
    expect(split.unpaidDays).toBe(0);
  });

  it("splits the excess into unpaid when exceed+excessBecomesUnpaid", async () => {
    const settings = makeSettings({
      allowExceedBalance: true,
      excessBecomesUnpaid: true,
    });
    const split = await computeAnnualSplit(
      makeUser(),
      settings,
      endDate,
      30,
      ly,
    );
    expect(split.paidDays).toBe(24);
    expect(split.unpaidDays).toBe(6);
  });

  it("keeps all days paid when exceed allowed but excess is NOT unpaid", async () => {
    const settings = makeSettings({
      allowExceedBalance: true,
      excessBecomesUnpaid: false,
    });
    const split = await computeAnnualSplit(
      makeUser(),
      settings,
      endDate,
      30,
      ly,
    );
    expect(split.paidDays).toBe(30);
    expect(split.unpaidDays).toBe(0);
  });

  it("splits the excess into unpaid when exceeding is disallowed", async () => {
    const settings = makeSettings({ allowExceedBalance: false });
    const split = await computeAnnualSplit(
      makeUser(),
      settings,
      endDate,
      30,
      ly,
    );
    expect(split.paidDays).toBe(24);
    expect(split.unpaidDays).toBe(6);
  });

  it("subtracts already-committed paid days from what's available", async () => {
    const settings = makeSettings();
    // 20 paid days already committed this leave year => only 4 left paid.
    mockState.leaveRows = [
      { type: "annual", status: "approved", paidDays: 20 },
    ];
    const split = await computeAnnualSplit(
      makeUser(),
      settings,
      endDate,
      10,
      ly,
    );
    expect(split.availableForPaid).toBe(4);
    expect(split.paidDays).toBe(4);
    expect(split.unpaidDays).toBe(6);
  });

  it("honours a positive balance adjustment", async () => {
    const settings = makeSettings();
    const user = makeUser({ balanceAdjustment: 5 });
    const split = await computeAnnualSplit(user, settings, endDate, 10, ly);
    expect(split.availableForPaid).toBe(29);
    expect(split.paidDays).toBe(10);
    expect(split.unpaidDays).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeBalance — aggregation incl. sick over-allowance
// ---------------------------------------------------------------------------
describe("computeBalance", () => {
  it("aggregates paid/unpaid/pending and sick usage for the leave year", async () => {
    const settings = makeSettings();
    mockState.leaveRows = [
      {
        type: "annual",
        status: "approved",
        workingDays: 7,
        paidDays: 5,
        unpaidDays: 2,
      },
      {
        type: "annual",
        status: "pending",
        workingDays: 3,
        paidDays: 2,
        unpaidDays: 1,
      },
      {
        type: "sick",
        status: "approved",
        workingDays: 4,
        paidDays: 4,
        unpaidDays: 0,
      },
    ];
    const balance = await computeBalance(makeUser(), settings, "2026-09-30");
    expect(balance.leaveYear).toBe(2025);
    expect(balance.accrued).toBe(24);
    expect(balance.carriedOver).toBe(0); // carry-over disabled (cap 0)
    expect(balance.usedPaid).toBe(5);
    expect(balance.usedUnpaid).toBe(2);
    expect(balance.pending).toBe(3);
    expect(balance.wouldBeUnpaid).toBe(1);
    expect(balance.available).toBe(19); // 24 accrued - 5 used paid
    expect(balance.sickUsed).toBe(4);
    expect(balance.sickRemaining).toBe(6); // 10 - 4
  });

  it("reports negative sick remaining when usage exceeds the allowance", async () => {
    const settings = makeSettings();
    mockState.leaveRows = [
      {
        type: "sick",
        status: "approved",
        workingDays: 12,
        paidDays: 12,
        unpaidDays: 0,
      },
    ];
    const balance = await computeBalance(makeUser(), settings, "2026-09-30");
    expect(balance.sickUsed).toBe(12);
    expect(balance.sickRemaining).toBe(-2); // 10 - 12 => over allowance
  });
});

// ---------------------------------------------------------------------------
// computeCarryOver — unused paid days rolled into the next year, capped
//
// Note: the in-memory db mock returns the same `leaveRows` for every leave-year
// query, so the previous year's approved usage mirrors whatever is set below.
// ---------------------------------------------------------------------------
describe("computeCarryOver (rollover, capped)", () => {
  // Member started at the start of the *previous* leave year so exactly one
  // prior year exists to carry from (bounds the recursion for the assertion).
  const startedPrevYear = { startDate: "2024-10-01" };

  it("returns 0 when the cap is 0 (carry-over disabled)", async () => {
    const settings = makeSettings({ maxRolloverDays: 0 });
    const balance = await computeBalance(
      makeUser(startedPrevYear),
      settings,
      "2025-10-01",
    );
    expect(balance.carriedOver).toBe(0);
  });

  it("carries the previous year's full unused paid balance up to the cap", async () => {
    const settings = makeSettings({ maxRolloverDays: 4 });
    // Prev year (2024/25) accrues 24, uses 5 paid => 19 unused; capped at 4.
    mockState.leaveRows = [
      { type: "annual", status: "approved", workingDays: 5, paidDays: 5, unpaidDays: 0 },
    ];
    const balance = await computeBalance(
      makeUser(startedPrevYear),
      settings,
      "2025-10-01",
    );
    expect(balance.carriedOver).toBe(4);
  });

  it("carries the exact unused amount when it is below the cap", async () => {
    const settings = makeSettings({ maxRolloverDays: 4 });
    // Prev year accrues 24, uses 22 paid => 2 unused; below the cap of 4.
    mockState.leaveRows = [
      { type: "annual", status: "approved", workingDays: 22, paidDays: 22, unpaidDays: 0 },
    ];
    const balance = await computeBalance(
      makeUser(startedPrevYear),
      settings,
      "2025-10-01",
    );
    expect(balance.carriedOver).toBe(2);
  });

  it("never carries a negative amount when the previous year was overspent", async () => {
    const settings = makeSettings({ maxRolloverDays: 4 });
    // Prev year used 30 paid against 24 accrued => negative; clamped to 0.
    mockState.leaveRows = [
      { type: "annual", status: "approved", workingDays: 30, paidDays: 30, unpaidDays: 0 },
    ];
    const balance = await computeBalance(
      makeUser(startedPrevYear),
      settings,
      "2025-10-01",
    );
    expect(balance.carriedOver).toBe(0);
  });

  it("does not carry into a member's first leave year", async () => {
    const settings = makeSettings({ maxRolloverDays: 4 });
    mockState.leaveRows = [
      { type: "annual", status: "approved", workingDays: 5, paidDays: 5, unpaidDays: 0 },
    ];
    // Member starts in the current leave year => no prior year to carry from.
    const balance = await computeBalance(
      makeUser({ startDate: "2025-10-01" }),
      settings,
      "2025-10-01",
    );
    expect(balance.carriedOver).toBe(0);
  });

  it("adds the carried days into the available balance", async () => {
    const settings = makeSettings({ maxRolloverDays: 4 });
    mockState.leaveRows = [
      { type: "annual", status: "approved", workingDays: 5, paidDays: 5, unpaidDays: 0 },
    ];
    // As of 2025-10-28 one accrual event (2) has fired in the current year.
    // available = accrued(2) + carriedOver(4) + adj(0) - usedPaid(5) = 1
    const balance = await computeBalance(
      makeUser(startedPrevYear),
      settings,
      "2025-10-28",
    );
    expect(balance.accrued).toBe(2);
    expect(balance.carriedOver).toBe(4);
    expect(balance.available).toBe(1);
  });

  it("lets carried days be booked as paid via computeAnnualSplit", async () => {
    const settings = makeSettings({ maxRolloverDays: 4 });
    // Prev year fully unused => carries the cap of 4. No current-year usage.
    // availableForPaid = accrued(24) + carriedOver(4) = 28.
    const ly = leaveYearOf("2026-01-01", settings); // 2025/2026
    const split = await computeAnnualSplit(
      makeUser(startedPrevYear),
      settings,
      "2026-09-30",
      26,
      ly,
    );
    expect(split.availableForPaid).toBe(28);
    expect(split.paidDays).toBe(26);
    expect(split.unpaidDays).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// carryOverDeadline + use-by forfeiture
//
// Leave year 1 Oct -> 30 Sep, deadline 3 months in => 1 Jan. As of 31 Dec the
// carried days still count; on/after 1 Jan any UNUSED carried days are forfeited.
// (The db mock returns the same leaveRows for every query, so previous-year
//  usage mirrors current-year usage.)
// ---------------------------------------------------------------------------
describe("carryOverDeadline (date derivation)", () => {
  it("is N months after the leave-year start", () => {
    const s = makeSettings({ carryOverDeadlineMonths: 3 });
    const ly = leaveYearOf("2026-01-01", s); // 2025-10-01 .. 2026-09-30
    expect(carryOverDeadline(s, ly)).toBe("2026-01-01");
  });

  it("returns null when no deadline is configured (0 months)", () => {
    const s = makeSettings({ carryOverDeadlineMonths: 0 });
    const ly = leaveYearOf("2026-01-01", s);
    expect(carryOverDeadline(s, ly)).toBeNull();
  });

  it("clamps the day to the last day of a short target month", () => {
    // Start 31 Mar, +11 months => Feb: clamps to 28 (2027 non-leap).
    const s = makeSettings({
      leaveYearStartMonth: 3,
      leaveYearStartDay: 31,
      carryOverDeadlineMonths: 11,
    });
    const ly = leaveYearOf("2026-04-01", s); // 2026-03-31 .. 2027-03-30
    expect(carryOverDeadline(s, ly)).toBe("2027-02-28");
  });
});

describe("computeBalance use-by deadline forfeiture", () => {
  const startedPrevYear = { startDate: "2024-10-01" };

  it("keeps carried days in the balance before the deadline", async () => {
    const settings = makeSettings({
      maxRolloverDays: 4,
      carryOverDeadlineMonths: 3, // deadline 2026-01-01
    });
    // Prev year fully unused => carries the cap of 4. No current-year usage.
    const balance = await computeBalance(
      makeUser(startedPrevYear),
      settings,
      "2025-12-31", // one day before the deadline
    );
    // Accrued Oct28/Nov28/Dec28 => 6, plus the 4 carried.
    expect(balance.carriedOver).toBe(4);
    expect(balance.carryOverDeadline).toBe("2026-01-01");
    expect(balance.accrued).toBe(6);
    expect(balance.available).toBe(10);
  });

  it("forfeits unused carried days on/after the deadline", async () => {
    const settings = makeSettings({
      maxRolloverDays: 4,
      carryOverDeadlineMonths: 3,
    });
    const balance = await computeBalance(
      makeUser(startedPrevYear),
      settings,
      "2026-01-01", // the deadline itself
    );
    // carriedOver still reports the historical 4, but none survive into
    // available since nothing was used before the deadline.
    expect(balance.carriedOver).toBe(4);
    expect(balance.accrued).toBe(6);
    expect(balance.available).toBe(6); // 6 accrued, 4 carried forfeited
  });

  it("preserves carried days that were consumed before the deadline", async () => {
    const settings = makeSettings({
      maxRolloverDays: 4,
      carryOverDeadlineMonths: 3,
    });
    // 1 approved paid day (consumes carried first). Prev year unused => cap 4.
    mockState.leaveRows = [
      { type: "annual", status: "approved", workingDays: 1, paidDays: 1, unpaidDays: 0 },
    ];
    const before = await computeBalance(
      makeUser(startedPrevYear),
      settings,
      "2025-12-31",
    );
    // before deadline: 6 accrued + 4 carried - 1 used = 9
    expect(before.available).toBe(9);

    const after = await computeBalance(
      makeUser(startedPrevYear),
      settings,
      "2026-01-01",
    );
    // after deadline: only the 1 consumed carried day survives => 6 + 1 - 1 = 6
    expect(after.available).toBe(6);
    expect(after.carriedOver).toBe(4);
  });

  it("never forfeits when no deadline is configured (0 months)", async () => {
    const settings = makeSettings({
      maxRolloverDays: 4,
      carryOverDeadlineMonths: 0,
    });
    const balance = await computeBalance(
      makeUser(startedPrevYear),
      settings,
      "2026-09-30", // deep into the year
    );
    // Full year accrued (24) + 4 carried, all still available.
    expect(balance.carryOverDeadline).toBeNull();
    expect(balance.carriedOver).toBe(4);
    expect(balance.available).toBe(28);
  });

  it("excludes forfeited carried days from what can be booked as paid", async () => {
    const settings = makeSettings({
      maxRolloverDays: 4,
      carryOverDeadlineMonths: 3,
    });
    // Booking a request that starts on/after the deadline with no prior usage:
    // carried is forfeited, so only the accrued 24 is available for paid.
    const ly = leaveYearOf("2026-01-01", settings); // 2025/2026
    const split = await computeAnnualSplit(
      makeUser(startedPrevYear),
      settings,
      "2026-09-30",
      26,
      ly,
    );
    expect(split.availableForPaid).toBe(24); // carried 4 forfeited
    expect(split.paidDays).toBe(24);
    expect(split.unpaidDays).toBe(2);
  });
});
