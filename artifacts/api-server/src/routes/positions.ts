import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, positionsTable } from "@workspace/db";
import {
  GetPositionsQueryParams,
  CreatePositionBody,
  GetPositionParams,
} from "@workspace/api-zod";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/positions", authMiddleware, async (req, res): Promise<void> => {
  const query = GetPositionsQueryParams.safeParse(req.query);
  const departmentId = query.success ? query.data.department_id : undefined;
  const results = departmentId != null
    ? await db.select().from(positionsTable).where(eq(positionsTable.departmentId, departmentId)).orderBy(positionsTable.title)
    : await db.select().from(positionsTable).orderBy(positionsTable.title);
  res.json(results);
});

router.post("/positions", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const parsed = CreatePositionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [position] = await db.insert(positionsTable).values({
    title: parsed.data.title,
    departmentId: parsed.data.departmentId ?? null,
    totalCount: parsed.data.totalCount ?? 1,
  }).returning();
  res.status(201).json(position);
});

router.get("/positions/:id", authMiddleware, async (req, res): Promise<void> => {
  const params = GetPositionParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid position id" });
    return;
  }
  const [position] = await db.select().from(positionsTable).where(eq(positionsTable.id, params.data.id));
  if (!position) {
    res.status(404).json({ error: "Position not found" });
    return;
  }
  res.json(position);
});

export default router;
