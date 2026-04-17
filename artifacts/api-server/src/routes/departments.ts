import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, departmentsTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/departments", authMiddleware, async (req, res): Promise<void> => {
  const agencyId = req.query.agency_id ? parseInt(req.query.agency_id as string, 10) : undefined;
  let query = db.select().from(departmentsTable);
  const results = agencyId
    ? await db.select().from(departmentsTable).where(eq(departmentsTable.agencyId, agencyId))
    : await query.orderBy(departmentsTable.name);
  res.json(results);
});

router.post("/departments", authMiddleware, async (req, res): Promise<void> => {
  const { name, agencyId } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [dept] = await db.insert(departmentsTable).values({ name, agencyId: agencyId ?? null }).returning();
  res.status(201).json(dept);
});

router.get("/departments/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [dept] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, id));
  if (!dept) {
    res.status(404).json({ error: "Department not found" });
    return;
  }
  res.json(dept);
});

router.put("/departments/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { name, agencyId } = req.body;
  const [dept] = await db.update(departmentsTable).set({ name, agencyId }).where(eq(departmentsTable.id, id)).returning();
  if (!dept) {
    res.status(404).json({ error: "Department not found" });
    return;
  }
  res.json(dept);
});

export default router;
