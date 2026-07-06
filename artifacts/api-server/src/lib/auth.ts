import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { eq, isNotNull, and } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";
import { getSettings } from "./settings";
import { splitName } from "./names";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      localUser?: User;
    }
  }
}

function todayStr(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Only re-check Clerk for a name change at most this often per user. Provisioning
// runs on every authenticated request, so an unthrottled Clerk lookup would add
// an API round-trip to every call.
const NAME_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

// Extract a real (human-provided) name from a Clerk user. Returns null when
// Clerk has no first/last name — a username/email fallback is not "better" than
// whatever we already stored, so we leave the local record untouched.
function clerkRealName(clerkUser: {
  firstName?: string | null;
  lastName?: string | null;
}): { firstName: string; lastName: string; name: string } | null {
  const firstName = clerkUser.firstName?.trim() ?? "";
  const lastName = clerkUser.lastName?.trim() ?? "";
  if (!firstName && !lastName) return null;
  return { firstName, lastName, name: [firstName, lastName].filter(Boolean).join(" ") };
}

// Keep an existing user's display name in sync with Clerk.
//
// Name precedence (highest wins):
//   1. A name a human explicitly set (nameManuallySet=true) — the user on their
//      profile, or an admin creating/editing them. Never overwritten by Clerk.
//   2. A name Clerk currently provides (first/last). Synced here on sign-in.
//   3. A name we derived (split from a legacy `name`, or a username/email
//      fallback). Replaced as soon as Clerk offers real values.
//
// Clerk lookups are throttled via nameSyncedAt, and Clerk failures never block
// authentication — we just return the record we already have.
async function syncNameFromClerk(user: User): Promise<User> {
  if (user.nameManuallySet || !user.clerkUserId) return user;
  const lastSynced = user.nameSyncedAt?.getTime() ?? 0;
  if (Date.now() - lastSynced < NAME_SYNC_INTERVAL_MS) return user;

  let clerkUser;
  try {
    clerkUser = await clerkClient.users.getUser(user.clerkUserId);
  } catch {
    return user;
  }
  const now = new Date();
  const real = clerkRealName(clerkUser);
  const unchanged =
    !real ||
    (real.firstName === user.firstName &&
      real.lastName === user.lastName &&
      real.name === user.name);
  const [updated] = await db
    .update(usersTable)
    .set(unchanged ? { nameSyncedAt: now } : { ...real, nameSyncedAt: now })
    .where(eq(usersTable.id, user.id))
    .returning();
  return updated ?? user;
}

async function provisionUser(clerkUserId: string): Promise<User> {
  const [existingByClerk] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, clerkUserId));
  if (existingByClerk) return syncNameFromClerk(existingByClerk);

  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const primaryEmail =
    clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    `${clerkUserId}@unknown.local`;
  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    clerkUser.username ||
    primaryEmail;
  let firstName = clerkUser.firstName?.trim() ?? "";
  let lastName = clerkUser.lastName?.trim() ?? "";
  if (!firstName) {
    const split = splitName(name);
    firstName = split.firstName;
    lastName = lastName || split.lastName;
  }

  // Link to an admin-precreated record with the same email, if one exists.
  const [existingByEmail] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, primaryEmail));
  if (existingByEmail) {
    const finalName = existingByEmail.name || name;
    let finalFirst = existingByEmail.firstName?.trim() ?? "";
    let finalLast = existingByEmail.lastName?.trim() ?? "";
    // Legacy/precreated rows may have a name but blank first/last — backfill
    // them by splitting the existing name, or fall back to the Clerk values.
    if (!finalFirst) {
      if (existingByEmail.name) {
        const split = splitName(existingByEmail.name);
        finalFirst = split.firstName;
        finalLast = split.lastName;
      } else {
        finalFirst = firstName;
        finalLast = lastName;
      }
    }
    const [linked] = await db
      .update(usersTable)
      .set({
        clerkUserId,
        name: finalName,
        firstName: finalFirst,
        lastName: finalLast,
        // An admin explicitly named this precreated record, so it outranks
        // whatever Clerk reports — freeze it against the sign-in sync.
        nameManuallySet: true,
      })
      .where(eq(usersTable.id, existingByEmail.id))
      .returning();
    return linked;
  }

  // Bootstrap: the first real person to sign in becomes an admin.
  const [linkedAdmin] = await db
    .select()
    .from(usersTable)
    .where(
      and(eq(usersTable.role, "admin"), isNotNull(usersTable.clerkUserId)),
    );
  const role = linkedAdmin ? "user" : "admin";

  const settings = await getSettings();
  const [created] = await db
    .insert(usersTable)
    .values({
      clerkUserId,
      name,
      firstName,
      lastName,
      // Freshly provisioned from Clerk — record the sync so we don't re-fetch
      // Clerk on the very next request.
      nameSyncedAt: new Date(),
      email: primaryEmail,
      role,
      startDate: todayStr(),
      annualEntitlement: settings.annualEntitlement,
      sickEntitlement: settings.sickEntitlement,
    })
    .returning();
  return created;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const user = await provisionUser(clerkUserId);
    if (!user.active) {
      res.status(403).json({ error: "Account is deactivated" });
      return;
    }
    req.localUser = user;
    next();
  } catch (err) {
    req.log.error({ err }, "Failed to provision user");
    res.status(500).json({ error: "Failed to load user" });
  }
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.localUser?.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
