import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { authMiddleware, parseIntParam } from "../middlewares/auth";

const router: IRouter = Router();

/**
 * GET /notifications
 * Get current user's notifications (unread_only query param optional)
 */
router.get("/notifications", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const unreadOnly = req.query.unread_only === "true";

    const conditions = unreadOnly
      ? and(eq(notificationsTable.userId, userId), eq(notificationsTable.read, false))
      : eq(notificationsTable.userId, userId);

    const notifications = await db
      .select()
      .from(notificationsTable)
      .where(conditions)
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

/**
 * PATCH /notifications/:id/read
 * Mark a notification as read
 */
router.patch("/notifications/:id/read", authMiddleware, async (req: Request, res: Response) => {
  try {
    const notifId = parseIntParam(req.params.id);
    const userId = req.user!.userId;

    const [updated] = await db
      .update(notificationsTable)
      .set({ read: true })
      .where(and(eq(notificationsTable.id, notifId), eq(notificationsTable.userId, userId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});

/**
 * PATCH /notifications/read-all
 * Mark all current user's notifications as read
 */
router.patch("/notifications/read-all", authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const updated = await db
      .update(notificationsTable)
      .set({ read: true })
      .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.read, false)))
      .returning();

    res.json({ count: updated.length });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
});

export default router;
