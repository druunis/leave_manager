import { eq, and } from "drizzle-orm";
import { db, usersTable, notificationsTable } from "@workspace/db";
import { getSettings } from "./settings";
import { sendEmail } from "./email";

async function emailEnabled(): Promise<boolean> {
  const settings = await getSettings();
  return settings.emailNotifications;
}

export async function notifyUser(
  userId: number,
  type: string,
  title: string,
  message: string,
  requestId?: number,
): Promise<void> {
  await db.insert(notificationsTable).values({
    userId,
    type,
    title,
    message,
    requestId: requestId ?? null,
  });

  if (!(await emailEnabled())) return;
  const [user] = await db
    .select({ email: usersTable.email, active: usersTable.active })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  if (!user || !user.active || !user.email) return;
  await sendEmail({ to: user.email, subject: title, text: message });
}

export async function notifyAdmins(
  type: string,
  title: string,
  message: string,
  requestId?: number,
): Promise<void> {
  const admins = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(and(eq(usersTable.role, "admin"), eq(usersTable.active, true)));
  if (admins.length === 0) return;
  await db.insert(notificationsTable).values(
    admins.map((a) => ({
      userId: a.id,
      type,
      title,
      message,
      requestId: requestId ?? null,
    })),
  );

  if (!(await emailEnabled())) return;
  await Promise.all(
    admins
      .filter((a) => a.email)
      .map((a) => sendEmail({ to: a.email, subject: title, text: message })),
  );
}
