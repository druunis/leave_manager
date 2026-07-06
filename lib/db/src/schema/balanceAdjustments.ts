import {
  pgTable,
  serial,
  integer,
  text,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";

export const balanceAdjustmentsTable = pgTable("balance_adjustments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  adjustment: doublePrecision("adjustment").notNull(),
  note: text("note"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type BalanceAdjustment = typeof balanceAdjustmentsTable.$inferSelect;
export type InsertBalanceAdjustment =
  typeof balanceAdjustmentsTable.$inferInsert;
