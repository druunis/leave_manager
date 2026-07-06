import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { requireAuth, requireAdmin } from "../lib/auth";
import { getSettings, clearSettingsCache } from "../lib/settings";
import { GetSettingsResponse, UpdateSettingsBody, UpdateSettingsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/settings", requireAuth, async (_req, res): Promise<void> => {
  const settings = await getSettings();
  res.json(GetSettingsResponse.parse(settings));
});

router.patch(
  "/admin/settings",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = UpdateSettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const current = await getSettings();
    const [updated] = await db
      .update(settingsTable)
      .set(parsed.data)
      .where(eq(settingsTable.id, current.id))
      .returning();
    clearSettingsCache();
    res.json(UpdateSettingsResponse.parse(updated));
  },
);

export default router;
