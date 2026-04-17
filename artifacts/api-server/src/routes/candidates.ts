import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, candidatesTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/candidates", authMiddleware, async (_req, res): Promise<void> => {
  const candidates = await db.select().from(candidatesTable).orderBy(candidatesTable.createdAt);
  res.json(candidates);
});

router.post("/candidates", async (req, res): Promise<void> => {
  const { name, email, phone, cvUrl } = req.body;
  if (!name || !email) {
    res.status(400).json({ error: "name and email are required" });
    return;
  }
  const [candidate] = await db.insert(candidatesTable).values({
    name,
    email,
    phone: phone ?? null,
    cvUrl: cvUrl ?? null,
  }).returning();
  res.status(201).json(candidate);
});

router.get("/candidates/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, id));
  if (!candidate) {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }
  res.json(candidate);
});

router.patch("/candidates/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { name, email, phone, cvUrl, parsedData } = req.body;
  const [candidate] = await db.update(candidatesTable)
    .set({ name, email, phone, cvUrl, parsedData })
    .where(eq(candidatesTable.id, id))
    .returning();
  if (!candidate) {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }
  res.json(candidate);
});

export default router;
