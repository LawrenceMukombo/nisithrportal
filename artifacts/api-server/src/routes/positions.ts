import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, positionsTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/positions", authMiddleware, async (req, res): Promise<void> => {
  const departmentId = req.query.department_id ? parseInt(req.query.department_id as string, 10) : undefined;
  const results = departmentId
    ? await db.select().from(positionsTable).where(eq(positionsTable.departmentId, departmentId))
    : await db.select().from(positionsTable).orderBy(positionsTable.title);
  res.json(results);
});

router.post("/positions", authMiddleware, async (req, res): Promise<void> => {
  const { title, departmentId, totalCount } = req.body;
  if (!title) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const [position] = await db.insert(positionsTable).values({
    title,
    departmentId: departmentId ?? null,
    totalCount: totalCount ?? 1,
  }).returning();
  res.status(201).json(position);
});

router.get("/positions/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [position] = await db.select().from(positionsTable).where(eq(positionsTable.id, id));
  if (!position) {
    res.status(404).json({ error: "Position not found" });
    return;
  }
  res.json(position);
});

export default router;
