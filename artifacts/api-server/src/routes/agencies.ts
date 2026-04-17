import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, agenciesTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/agencies", authMiddleware, async (_req, res): Promise<void> => {
  const agencies = await db.select().from(agenciesTable).orderBy(agenciesTable.name);
  res.json(agencies);
});

router.post("/agencies", authMiddleware, async (req, res): Promise<void> => {
  const { name, type } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [agency] = await db.insert(agenciesTable).values({ name, type: type ?? "government" }).returning();
  res.status(201).json(agency);
});

router.get("/agencies/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [agency] = await db.select().from(agenciesTable).where(eq(agenciesTable.id, id));
  if (!agency) {
    res.status(404).json({ error: "Agency not found" });
    return;
  }
  res.json(agency);
});

router.put("/agencies/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { name, type } = req.body;
  const [agency] = await db.update(agenciesTable).set({ name, type }).where(eq(agenciesTable.id, id)).returning();
  if (!agency) {
    res.status(404).json({ error: "Agency not found" });
    return;
  }
  res.json(agency);
});

export default router;
