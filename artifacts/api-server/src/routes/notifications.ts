import { Router, type IRouter } from "express";
import { and, eq, desc } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import {
  ListNotificationsResponse,
  MarkAllNotificationsReadResponse,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, req.localUser!.id))
    .orderBy(desc(notificationsTable.createdAt));
  res.json(ListNotificationsResponse.parse(rows));
});

router.post(
  "/notifications/read-all",
  requireAuth,
  async (req, res): Promise<void> => {
    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.userId, req.localUser!.id));
    res.json(MarkAllNotificationsReadResponse.parse({ unread: 0 }));
  },
);

router.post(
  "/notifications/:id/read",
  requireAuth,
  async (req, res): Promise<void> => {
    const params = MarkNotificationReadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [row] = await db
      .update(notificationsTable)
      .set({ read: true })
      .where(
        and(
          eq(notificationsTable.id, params.data.id),
          eq(notificationsTable.userId, req.localUser!.id),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
    res.json(MarkNotificationReadResponse.parse(row));
  },
);

export default router;
