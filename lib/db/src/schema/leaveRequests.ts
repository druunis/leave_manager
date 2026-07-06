import {
  pgTable,
  serial,
  integer,
  text,
  date,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";

export const leaveRequestsTable = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }).notNull(),
  workingDays: doublePrecision("working_days").notNull().default(0),
  paidDays: doublePrecision("paid_days").notNull().default(0),
  unpaidDays: doublePrecision("unpaid_days").notNull().default(0),
  status: text("status").notNull().default("pending"),
  userNote: text("user_note"),
  adminNote: text("admin_note"),
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  rejectedBy: integer("rejected_by"),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type LeaveRequest = typeof leaveRequestsTable.$inferSelect;
export type InsertLeaveRequest = typeof leaveRequestsTable.$inferInsert;
