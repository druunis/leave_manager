import {
  pgTable,
  serial,
  text,
  boolean,
  date,
  doublePrecision,
  timestamp,
} from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkUserId: text("clerk_user_id").unique(),
  name: text("name").notNull(),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  // True once a human (the user on their profile, or an admin) has explicitly
  // set the name. When true, the Clerk sign-in sync must never overwrite it.
  nameManuallySet: boolean("name_manually_set").notNull().default(false),
  // Last time we reconciled the name against Clerk. Used to throttle Clerk API
  // lookups, since provisioning runs on every authenticated request.
  nameSyncedAt: timestamp("name_synced_at", { withTimezone: true }),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("user"),
  startDate: date("start_date", { mode: "string" }).notNull(),
  active: boolean("active").notNull().default(true),
  annualEntitlement: doublePrecision("annual_entitlement").notNull().default(37),
  sickEntitlement: doublePrecision("sick_entitlement").notNull().default(5),
  balanceAdjustment: doublePrecision("balance_adjustment").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
