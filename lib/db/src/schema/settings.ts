import {
  pgTable,
  serial,
  integer,
  boolean,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  annualEntitlement: doublePrecision("annual_entitlement").notNull().default(37),
  sickEntitlement: doublePrecision("sick_entitlement").notNull().default(5),
  leaveYearStartMonth: integer("leave_year_start_month").notNull().default(10),
  leaveYearStartDay: integer("leave_year_start_day").notNull().default(1),
  accrualDay: integer("accrual_day").notNull().default(28),
  maxRolloverDays: integer("max_rollover_days").notNull().default(4),
  carryOverDeadlineMonths: integer("carry_over_deadline_months")
    .notNull()
    .default(3),
  allowExceedBalance: boolean("allow_exceed_balance").notNull().default(true),
  excessBecomesUnpaid: boolean("excess_becomes_unpaid").notNull().default(true),
  autoWeekends: boolean("auto_weekends").notNull().default(false),
  allowHalfDays: boolean("allow_half_days").notNull().default(false),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Settings = typeof settingsTable.$inferSelect;
export type InsertSettings = typeof settingsTable.$inferInsert;
