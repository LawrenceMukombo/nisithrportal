import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc, asc, inArray, sql, not } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import {
  db,
  chatConversationsTable,
  chatParticipantsTable,
  chatMessagesTable,
  usersTable,
  rolesTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";
import { createNotification } from "../lib/notificationService";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Configure multer for chat attachments (images, PDFs, documents, audio voice notes)
const uploadDir = path.resolve(process.cwd(), "uploads", "chat");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

function getParamString(param: unknown): string {
  if (Array.isArray(param)) return String(param[0] || "");
  return typeof param === "string" ? param : String(param || "");
}

/**
 * GET /api/messages/conversations
 * List all conversations the authenticated user is participating in.
 */
router.get("/messages/conversations", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    // Find all conversation IDs where current user is a participant
    const userParticipations = await db
      .select()
      .from(chatParticipantsTable)
      .where(eq(chatParticipantsTable.userId, userId));

    if (userParticipations.length === 0) {
      res.json([]);
      return;
    }

    const conversationIds = userParticipations.map((p) => p.conversationId);

    // Fetch conversation records
    const conversations = await db
      .select()
      .from(chatConversationsTable)
      .where(inArray(chatConversationsTable.id, conversationIds))
      .orderBy(desc(chatConversationsTable.lastMessageAt));

    // Fetch all participants for these conversations
    const allParticipants = await db
      .select({
        participant: chatParticipantsTable,
        user: {
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          roleId: usersTable.roleId,
          lastLoginAt: usersTable.lastLoginAt,
        },
      })
      .from(chatParticipantsTable)
      .innerJoin(usersTable, eq(chatParticipantsTable.userId, usersTable.id))
      .where(inArray(chatParticipantsTable.conversationId, conversationIds));

    // Group participants by conversationId
    const participantsByConv = new Map<number, typeof allParticipants>();
    for (const p of allParticipants) {
      const list = participantsByConv.get(p.participant.conversationId) || [];
      list.push(p);
      participantsByConv.set(p.participant.conversationId, list);
    }

    // Build rich response with unread count for current user
    const results = await Promise.all(
      conversations.map(async (conv) => {
        const myPart = userParticipations.find((p) => p.conversationId === conv.id);
        const lastRead = myPart?.lastReadAt ? new Date(myPart.lastReadAt) : new Date(0);

        // Count unread messages
        const [unreadRes] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(chatMessagesTable)
          .where(
            and(
              eq(chatMessagesTable.conversationId, conv.id),
              not(eq(chatMessagesTable.senderId, userId)),
              sql`${chatMessagesTable.createdAt} > ${lastRead}`,
              eq(chatMessagesTable.deletedForEveryone, false)
            )
          );

        const convParticipants = participantsByConv.get(conv.id) || [];
        const otherParticipants = convParticipants.filter((p) => p.user.id !== userId);

        // For direct chats, derive title and avatar from the other person
        let title = conv.title;
        const avatar = conv.avatar;
        const otherUser = otherParticipants[0]?.user;

        if (conv.type === "direct" && otherUser) {
          title = otherUser.name;
        }

        return {
          id: conv.id,
          type: conv.type,
          title: title || "Conversation",
          avatar: avatar || null,
          lastMessageAt: conv.lastMessageAt,
          lastMessagePreview: conv.lastMessagePreview,
          unreadCount: unreadRes?.count || 0,
          muted: myPart?.muted || false,
          participants: convParticipants.map((p) => ({
            userId: p.user.id,
            name: p.user.name,
            email: p.user.email,
            role: p.participant.role,
            lastReadAt: p.participant.lastReadAt,
            lastLoginAt: p.user.lastLoginAt,
          })),
          otherUser: otherUser || null,
        };
      })
    );

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

/**
 * POST /api/messages/conversations
 * Create a new 1-on-1 or group conversation.
 */
router.post("/messages/conversations", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const agencyId = req.user!.agencyId || 1;
    const body = req.body || {};
    const type = body.type || "direct";

    const targetUserId = Number(
      body.targetUserId ||
      (Array.isArray(body.participantUserIds) ? body.participantUserIds.find((id: any) => Number(id) !== userId) : undefined) ||
      (Array.isArray(body.participantIds) ? body.participantIds.find((id: any) => Number(id) !== userId) : undefined)
    );

    if (type === "direct") {
      if (!targetUserId || targetUserId === userId) {
        res.status(400).json({ error: "Valid target user required for direct chat" });
        return;
      }

      // Check if a direct conversation already exists between these 2 users
      const existing = await db
        .select({ conversationId: chatParticipantsTable.conversationId })
        .from(chatParticipantsTable)
        .innerJoin(chatConversationsTable, eq(chatParticipantsTable.conversationId, chatConversationsTable.id))
        .where(
          and(
            eq(chatConversationsTable.type, "direct"),
            inArray(chatParticipantsTable.userId, [userId, targetUserId])
          )
        )
        .groupBy(chatParticipantsTable.conversationId)
        .having(sql`count(distinct ${chatParticipantsTable.userId}) = 2`);

      if (existing.length > 0) {
        res.json({ id: existing[0].conversationId, isExisting: true });
        return;
      }

      // Create new direct conversation
      const [conv] = await db
        .insert(chatConversationsTable)
        .values({
          agencyId,
          type: "direct",
          createdBy: userId,
          lastMessageAt: new Date(),
          lastMessagePreview: "Started conversation",
        })
        .returning();

      // Add both participants
      await db.insert(chatParticipantsTable).values([
        { conversationId: conv.id, userId, role: "member" },
        { conversationId: conv.id, userId: targetUserId, role: "member" },
      ]);

      res.status(201).json({ id: conv.id, isExisting: false });
      return;
    }

    // Group chat
    const title = body.title;
    if (!title || !title.trim()) {
      res.status(400).json({ error: "Title required for group conversations" });
      return;
    }

    const rawList = Array.isArray(body.participantUserIds)
      ? body.participantUserIds
      : Array.isArray(body.participantIds)
      ? body.participantIds
      : [];
    const validMemberIds = rawList.map((id: any) => Number(id)).filter((id: number) => !isNaN(id) && id > 0);
    const uniqueParticipants = Array.from(new Set([userId, ...validMemberIds]));

    const [conv] = await db
      .insert(chatConversationsTable)
      .values({
        agencyId,
        type: "group",
        title: title.trim(),
        createdBy: userId,
        lastMessageAt: new Date(),
        lastMessagePreview: "Group created",
      })
      .returning();

    await db.insert(chatParticipantsTable).values(
      uniqueParticipants.map((pId) => ({
        conversationId: conv.id,
        userId: Number(pId),
        role: pId === userId ? "admin" : "member",
      }))
    );

    res.status(201).json({ id: conv.id, isExisting: false });
  } catch (error) {
    logger.error({ err: error }, "Failed to create conversation");
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

/**
 * GET /api/messages/conversations/:id/messages
 * Get message history for a conversation.
 */
router.get("/messages/conversations/:id/messages", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const conversationId = parseInt(getParamString(req.params.id), 10);

    if (isNaN(conversationId)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    // Verify user is a participant
    const [part] = await db
      .select()
      .from(chatParticipantsTable)
      .where(
        and(
          eq(chatParticipantsTable.conversationId, conversationId),
          eq(chatParticipantsTable.userId, userId)
        )
      );

    if (!part) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    // Get messages with sender info
    const messages = await db
      .select({
        id: chatMessagesTable.id,
        conversationId: chatMessagesTable.conversationId,
        senderId: chatMessagesTable.senderId,
        senderName: usersTable.name,
        senderEmail: usersTable.email,
        messageType: chatMessagesTable.messageType,
        content: chatMessagesTable.content,
        attachmentUrl: chatMessagesTable.attachmentUrl,
        attachmentName: chatMessagesTable.attachmentName,
        attachmentSize: chatMessagesTable.attachmentSize,
        replyToId: chatMessagesTable.replyToId,
        deletedForEveryone: chatMessagesTable.deletedForEveryone,
        createdAt: chatMessagesTable.createdAt,
      })
      .from(chatMessagesTable)
      .innerJoin(usersTable, eq(chatMessagesTable.senderId, usersTable.id))
      .where(eq(chatMessagesTable.conversationId, conversationId))
      .orderBy(asc(chatMessagesTable.createdAt));

    // Also get read timestamps of other participants to display read receipts (blue ticks)
    const otherParticipants = await db
      .select()
      .from(chatParticipantsTable)
      .where(
        and(
          eq(chatParticipantsTable.conversationId, conversationId),
          not(eq(chatParticipantsTable.userId, userId))
        )
      );

    const latestOtherRead = otherParticipants.reduce((latest, p) => {
      if (!p.lastReadAt) return latest;
      const t = new Date(p.lastReadAt).getTime();
      return t > latest ? t : latest;
    }, 0);

    const enriched = messages.map((m) => {
      const msgTime = new Date(m.createdAt).getTime();
      const isReadByRecipient = m.senderId === userId && latestOtherRead >= msgTime;

      return {
        ...m,
        isMine: m.senderId === userId,
        isRead: isReadByRecipient,
      };
    });

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ error: "Failed to load messages" });
  }
});

/**
 * POST /api/messages/conversations/:id/messages
 * Send a new message.
 */
router.post("/messages/conversations/:id/messages", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const conversationId = parseInt(getParamString(req.params.id), 10);
    const { content = "", messageType = "text", attachmentUrl, attachmentName, attachmentSize, replyToId } = req.body;

    if (isNaN(conversationId)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    if (!content.trim() && !attachmentUrl) {
      res.status(400).json({ error: "Message content or attachment required" });
      return;
    }

    // Verify participation
    const [part] = await db
      .select()
      .from(chatParticipantsTable)
      .where(
        and(
          eq(chatParticipantsTable.conversationId, conversationId),
          eq(chatParticipantsTable.userId, userId)
        )
      );

    if (!part) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    // Insert message
    const [msg] = await db
      .insert(chatMessagesTable)
      .values({
        conversationId,
        senderId: userId,
        messageType,
        content: content.trim(),
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
        attachmentSize: attachmentSize || null,
        replyToId: replyToId ? Number(replyToId) : null,
      })
      .returning();

    // Generate preview snippet
    let preview = content.trim();
    if (messageType === "image") preview = "📷 Photo";
    else if (messageType === "document") preview = `📄 ${attachmentName || "Document"}`;
    else if (messageType === "voice") preview = "🎤 Voice message";

    // Update conversation timestamp
    await db
      .update(chatConversationsTable)
      .set({
        lastMessageAt: new Date(),
        lastMessagePreview: preview.slice(0, 120),
        updatedAt: new Date(),
      })
      .where(eq(chatConversationsTable.id, conversationId));

    // Update sender's lastReadAt so they are marked as read
    await db
      .update(chatParticipantsTable)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(chatParticipantsTable.conversationId, conversationId),
          eq(chatParticipantsTable.userId, userId)
        )
      );

    // Notify other participants
    const recipients = await db
      .select({ userId: chatParticipantsTable.userId, name: usersTable.name })
      .from(chatParticipantsTable)
      .innerJoin(usersTable, eq(chatParticipantsTable.userId, usersTable.id))
      .where(
        and(
          eq(chatParticipantsTable.conversationId, conversationId),
          not(eq(chatParticipantsTable.userId, userId))
        )
      );

    const senderName = req.user?.email ? req.user.email.split("@")[0] : "Colleague";

    for (const r of recipients) {
      void createNotification({
        userId: r.userId,
        type: "chat_message",
        message: `New message from ${senderName}: ${preview.slice(0, 60)}`,
      }).catch(() => {});
    }

    res.status(201).json(msg);
  } catch (error) {
    res.status(500).json({ error: "Failed to send message" });
  }
});

/**
 * PATCH /api/messages/conversations/:id/read
 * Mark all messages in a conversation as read by current user.
 */
router.patch("/messages/conversations/:id/read", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const conversationId = parseInt(getParamString(req.params.id), 10);

    if (isNaN(conversationId)) {
      res.status(400).json({ error: "Invalid conversation ID" });
      return;
    }

    await db
      .update(chatParticipantsTable)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(chatParticipantsTable.conversationId, conversationId),
          eq(chatParticipantsTable.userId, userId)
        )
      );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

/**
 * POST /api/messages/upload
 * Upload image or document attachment.
 */
router.post("/messages/upload", authMiddleware, upload.single("file"), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const publicUrl = `/api/messages/files/${req.file.filename}`;
    res.json({
      url: publicUrl,
      name: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (error) {
    res.status(500).json({ error: "Upload failed" });
  }
});

/**
 * GET /api/messages/files/:filename
 * Serve uploaded chat files securely.
 */
router.get("/messages/files/:filename", authMiddleware, (req: Request, res: Response): void => {
  const filename = path.basename(getParamString(req.params.filename));
  const filePath = path.join(uploadDir, filename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.sendFile(filePath);
});

/**
 * GET /api/messages/users
 * Directory of staff / colleagues to initiate chats.
 */
router.get("/messages/users", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const currentUserId = req.user!.userId;
    const agencyId = req.user!.agencyId || 1;

    const users = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        roleId: usersTable.roleId,
        roleName: rolesTable.name,
        lastLoginAt: usersTable.lastLoginAt,
      })
      .from(usersTable)
      .leftJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
      .where(and(eq(usersTable.agencyId, agencyId), not(eq(usersTable.id, currentUserId))))
      .orderBy(usersTable.name);

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to load users directory" });
  }
});

/**
 * GET /api/messages/unread-total
 * Global badge counter for unread messages across all conversations.
 */
router.get("/messages/unread-total", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const userParticipations = await db
      .select()
      .from(chatParticipantsTable)
      .where(eq(chatParticipantsTable.userId, userId));

    if (userParticipations.length === 0) {
      res.json({ unreadTotal: 0 });
      return;
    }

    let total = 0;
    for (const part of userParticipations) {
      const lastRead = part.lastReadAt ? new Date(part.lastReadAt) : new Date(0);
      const [resCount] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(chatMessagesTable)
        .where(
          and(
            eq(chatMessagesTable.conversationId, part.conversationId),
            not(eq(chatMessagesTable.senderId, userId)),
            sql`${chatMessagesTable.createdAt} > ${lastRead}`,
            eq(chatMessagesTable.deletedForEveryone, false)
          )
        );
      total += resCount?.count || 0;
    }

    res.json({ unreadTotal: total });
  } catch (error) {
    res.json({ unreadTotal: 0 });
  }
});

export default router;
