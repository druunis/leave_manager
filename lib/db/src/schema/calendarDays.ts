import {
  pgTable,
  serial,
  integer,
  text,
  date,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const calendarDaysTable = pgTable(
  "calendar_days",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    status: text("status").notNull().default("working"),
    note: text("note"),
    requestId: integer("request_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique("calendar_days_user_date").on(t.userId, t.date)],
);

export type CalendarDay = typeof calendarDaysTable.$inferSelect;
export type InsertCalendarDay = typeof calendarDaysTable.$inferInsert;
