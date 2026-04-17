import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, jobsTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/jobs", async (req, res): Promise<void> => {
  const agencyId = req.query.agency_id ? parseInt(req.query.agency_id as string, 10) : undefined;
  const departmentId = req.query.department_id ? parseInt(req.query.department_id as string, 10) : undefined;
  const status = req.query.status as string | undefined;

  let jobs;
  const conditions = [];
  if (agencyId) conditions.push(eq(jobsTable.agencyId, agencyId));
  if (departmentId) conditions.push(eq(jobsTable.departmentId, departmentId));
  if (status) conditions.push(eq(jobsTable.status, status));

  if (conditions.length > 0) {
    jobs = await db.select().from(jobsTable).where(and(...conditions)).orderBy(jobsTable.createdAt);
  } else {
    jobs = await db.select().from(jobsTable).orderBy(jobsTable.createdAt);
  }
  res.json(jobs);
});

router.post("/jobs", authMiddleware, async (req, res): Promise<void> => {
  const { title, description, departmentId, agencyId, status, closingDate } = req.body;
  if (!title || !description) {
    res.status(400).json({ error: "title and description are required" });
    return;
  }
  const [job] = await db.insert(jobsTable).values({
    title,
    description,
    departmentId: departmentId ?? null,
    agencyId: agencyId ?? req.user?.agencyId ?? null,
    status: status ?? "draft",
    closingDate: closingDate ?? null,
    createdBy: req.user?.userId ?? null,
  }).returning();
  res.status(201).json(job);
});

router.get("/jobs/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

router.put("/jobs/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { title, description, departmentId, agencyId, status, closingDate } = req.body;
  const [job] = await db.update(jobsTable).set({
    title,
    description,
    departmentId,
    agencyId,
    status,
    closingDate,
  }).where(eq(jobsTable.id, id)).returning();
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

router.delete("/jobs/:id", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [job] = await db.delete(jobsTable).where(eq(jobsTable.id, id)).returning();
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.sendStatus(204);
});

router.patch("/jobs/:id/publish", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [job] = await db.update(jobsTable).set({ status: "published" }).where(eq(jobsTable.id, id)).returning();
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

router.patch("/jobs/:id/close", authMiddleware, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [job] = await db.update(jobsTable).set({ status: "closed" }).where(eq(jobsTable.id, id)).returning();
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

export default router;
