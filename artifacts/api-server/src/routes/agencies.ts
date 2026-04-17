import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, agenciesTable } from "@workspace/db";
import {
  CreateAgencyBody,
  GetAgencyParams,
  UpdateAgencyParams,
  UpdateAgencyBody,
  DeleteAgencyParams,
} from "@workspace/api-zod";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/agencies", authMiddleware, async (_req, res): Promise<void> => {
  const agencies = await db.select().from(agenciesTable).orderBy(agenciesTable.name);
  res.json(agencies);
});

router.post("/agencies", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  const parsed = CreateAgencyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [agency] = await db.insert(agenciesTable).values({
    name: parsed.data.name,
    type: parsed.data.type ?? "government",
  }).returning();
  res.status(201).json(agency);
});

router.get("/agencies/:id", authMiddleware, async (req, res): Promise<void> => {
  const params = GetAgencyParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid agency id" });
    return;
  }
  const [agency] = await db.select().from(agenciesTable).where(eq(agenciesTable.id, params.data.id));
  if (!agency) {
    res.status(404).json({ error: "Agency not found" });
    return;
  }
  res.json(agency);
});

router.delete("/agencies/:id", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  const params = DeleteAgencyParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid agency id" });
    return;
  }
  const [agency] = await db.delete(agenciesTable).where(eq(agenciesTable.id, params.data.id)).returning();
  if (!agency) {
    res.status(404).json({ error: "Agency not found" });
    return;
  }
  res.sendStatus(204);
});

router.put("/agencies/:id", authMiddleware, requireRole("admin"), async (req, res): Promise<void> => {
  const params = UpdateAgencyParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid agency id" });
    return;
  }
  const body = UpdateAgencyBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [agency] = await db.update(agenciesTable)
    .set({ name: body.data.name, type: body.data.type })
    .where(eq(agenciesTable.id, params.data.id))
    .returning();
  if (!agency) {
    res.status(404).json({ error: "Agency not found" });
    return;
  }
  res.json(agency);
});

export default router;
