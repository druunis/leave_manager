import { db, settingsTable, type Settings } from "@workspace/db";

let cached: Settings | null = null;

export async function getSettings(): Promise<Settings> {
  if (cached) return cached;
  const [existing] = await db.select().from(settingsTable).limit(1);
  if (existing) {
    cached = existing;
    return existing;
  }
  const [created] = await db.insert(settingsTable).values({}).returning();
  cached = created;
  return created;
}

export function clearSettingsCache(): void {
  cached = null;
}
