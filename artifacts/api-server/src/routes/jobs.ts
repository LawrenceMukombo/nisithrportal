import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, jobsTable } from "@workspace/db";
import {
  GetJobsQueryParams,
  CreateJobBody,
  GetJobParams,
  UpdateJobParams,
  UpdateJobBody,
  DeleteJobParams,
  PublishJobParams,
  CloseJobParams,
} from "@workspace/api-zod";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/jobs", async (req, res): Promise<void> => {
  const query = GetJobsQueryParams.safeParse(req.query);
  const conditions = [];
  if (query.success) {
    if (query.data.agency_id != null) conditions.push(eq(jobsTable.agencyId, query.data.agency_id));
    if (query.data.department_id != null) conditions.push(eq(jobsTable.departmentId, query.data.department_id));
    if (query.data.status != null) conditions.push(eq(jobsTable.status, query.data.status));
  }
  const jobs = conditions.length > 0
    ? await db.select().from(jobsTable).where(and(...conditions)).orderBy(jobsTable.createdAt)
    : await db.select().from(jobsTable).orderBy(jobsTable.createdAt);
  res.json(jobs);
});

router.post("/jobs", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [job] = await db.insert(jobsTable).values({
    title: parsed.data.title,
    description: parsed.data.description,
    departmentId: parsed.data.departmentId ?? null,
    agencyId: parsed.data.agencyId ?? req.user?.agencyId ?? null,
    status: parsed.data.status ?? "draft",
    closingDate: parsed.data.closingDate ?? null,
    createdBy: req.user?.userId ?? null,
  }).returning();
  res.status(201).json(job);
});

router.get("/jobs/:id", async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.id));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

router.put("/jobs/:id", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const params = UpdateJobParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const body = UpdateJobBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [job] = await db.update(jobsTable).set({
    title: body.data.title,
    description: body.data.description,
    departmentId: body.data.departmentId,
    agencyId: body.data.agencyId,
    status: body.data.status,
    closingDate: body.data.closingDate,
  }).where(eq(jobsTable.id, params.data.id)).returning();
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

router.delete("/jobs/:id", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const params = DeleteJobParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const [job] = await db.delete(jobsTable).where(eq(jobsTable.id, params.data.id)).returning();
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.sendStatus(204);
});

router.patch("/jobs/:id/publish", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const params = PublishJobParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const [job] = await db.update(jobsTable).set({ status: "published" }).where(eq(jobsTable.id, params.data.id)).returning();
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

router.patch("/jobs/:id/close", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const params = CloseJobParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const [job] = await db.update(jobsTable).set({ status: "closed" }).where(eq(jobsTable.id, params.data.id)).returning();
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

export default router;
