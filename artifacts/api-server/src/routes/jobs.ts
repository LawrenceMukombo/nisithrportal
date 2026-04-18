import { Router, type IRouter } from "express";
import { eq, and, inArray, asc } from "drizzle-orm";
import { z } from "zod/v4";
import { db, jobsTable, departmentsTable, jobScreeningQuestionsTable } from "@workspace/db";
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
import { authMiddleware, optionalAuth, requireRole, parseIntParam } from "../middlewares/auth";
import { getTenantAgencyId, assertTenantAccess } from "../middlewares/tenant";

const router: IRouter = Router();

router.get("/jobs", optionalAuth, async (req, res): Promise<void> => {
  const query = GetJobsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query parameters", details: query.error.issues });
    return;
  }
  const conditions = [];
  const isAuthenticated = req.user != null;

  if (req.user?.agencyId != null) {
    conditions.push(eq(jobsTable.agencyId, req.user.agencyId));
  }

  if (!isAuthenticated) {
    conditions.push(inArray(jobsTable.status, ["open", "published"]));
  } else if (query.data.status != null) {
    conditions.push(eq(jobsTable.status, query.data.status));
  }

  if (query.data.department_id != null) conditions.push(eq(jobsTable.departmentId, query.data.department_id));
  if (query.data.agency_id != null && req.user?.agencyId == null) {
    conditions.push(eq(jobsTable.agencyId, query.data.agency_id));
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
  const agencyId = getTenantAgencyId(req) ?? parsed.data.agencyId ?? null;
  if (agencyId == null) {
    res.status(403).json({ error: "Forbidden: no agency context — cannot create job" });
    return;
  }
  if (parsed.data.departmentId != null) {
    const dept = await db.select({ agencyId: departmentsTable.agencyId }).from(departmentsTable).where(eq(departmentsTable.id, parsed.data.departmentId)).then((r) => r[0]);
    if (!assertTenantAccess(res, dept?.agencyId ?? null, agencyId)) return;
  }
  const [job] = await db.insert(jobsTable).values({
    title: parsed.data.title,
    description: parsed.data.description,
    departmentId: parsed.data.departmentId ?? null,
    agencyId,
    status: parsed.data.status ?? "draft",
    closingDate: parsed.data.closingDate ?? null,
    createdBy: req.user?.userId ?? null,
  }).returning();
  res.status(201).json(job);
});

router.get("/jobs/:id", optionalAuth, async (req, res): Promise<void> => {
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
  const isOwnAgency = req.user?.agencyId != null && job.agencyId === req.user.agencyId;
  const isPublished = job.status === "published" || job.status === "open";

  if (!isPublished && !isOwnAgency) {
    // Draft/closed jobs are only visible to their own agency
    res.status(req.user ? 403 : 404).json({ error: "Job not found" });
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
  const [existing] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (!assertTenantAccess(res, existing.agencyId, getTenantAgencyId(req))) return;
  const body = UpdateJobBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (body.data.departmentId != null) {
    const dept = await db.select({ agencyId: departmentsTable.agencyId })
      .from(departmentsTable).where(eq(departmentsTable.id, body.data.departmentId)).then((r) => r[0]);
    if (!dept || dept.agencyId !== existing.agencyId) {
      res.status(403).json({ error: "Forbidden: department does not belong to this agency" });
      return;
    }
  }
  const [job] = await db.update(jobsTable).set({
    title: body.data.title,
    description: body.data.description,
    departmentId: body.data.departmentId,
    status: body.data.status,
    closingDate: body.data.closingDate,
  }).where(eq(jobsTable.id, params.data.id)).returning();
  res.json(job);
});

router.delete("/jobs/:id", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const params = DeleteJobParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const [existing] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (!assertTenantAccess(res, existing.agencyId, getTenantAgencyId(req))) return;
  await db.delete(jobsTable).where(eq(jobsTable.id, params.data.id));
  res.sendStatus(204);
});

router.patch("/jobs/:id/publish", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const params = PublishJobParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const [existing] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (!assertTenantAccess(res, existing.agencyId, getTenantAgencyId(req))) return;
  const [job] = await db.update(jobsTable).set({ status: "published" }).where(eq(jobsTable.id, params.data.id)).returning();
  res.json(job);
});

router.patch("/jobs/:id/close", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const params = CloseJobParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid job id" });
    return;
  }
  const [existing] = await db.select().from(jobsTable).where(eq(jobsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (!assertTenantAccess(res, existing.agencyId, getTenantAgencyId(req))) return;
  const [job] = await db.update(jobsTable).set({ status: "closed" }).where(eq(jobsTable.id, params.data.id)).returning();
  res.json(job);
});

// Screening questions management
const ScreeningQuestionBody = z.object({
  question: z.string().min(1),
  questionType: z.enum(["short_answer", "yes_no", "multiple_choice", "long_answer"]).default("short_answer"),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(true),
  displayOrder: z.number().int().optional(),
});

router.get("/jobs/:id/screening-questions", optionalAuth, async (req, res): Promise<void> => {
  const jobId = parseInt(req.params.id ?? "");
  if (isNaN(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }
  const questions = await db.select().from(jobScreeningQuestionsTable)
    .where(eq(jobScreeningQuestionsTable.jobId, jobId))
    .orderBy(asc(jobScreeningQuestionsTable.displayOrder));
  res.json(questions);
});

router.post("/jobs/:id/screening-questions", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const jobId = parseInt(req.params.id ?? "");
  if (isNaN(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }
  const parsed = ScreeningQuestionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  // Ensure job belongs to same agency
  const [job] = await db.select({ agencyId: jobsTable.agencyId }).from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (!assertTenantAccess(res, job.agencyId, getTenantAgencyId(req))) return;
  const [q] = await db.insert(jobScreeningQuestionsTable).values({
    jobId,
    question: parsed.data.question,
    questionType: parsed.data.questionType,
    options: parsed.data.options ?? null,
    required: parsed.data.required,
    displayOrder: parsed.data.displayOrder ?? 0,
  }).returning();
  res.status(201).json(q);
});

router.delete("/jobs/:id/screening-questions/:qid", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const jobId = parseInt(req.params.id ?? "");
  const qid = parseInt(req.params.qid ?? "");
  if (isNaN(jobId) || isNaN(qid)) { res.status(400).json({ error: "Invalid id" }); return; }
  // Verify the job belongs to the same agency before deleting
  const [job] = await db.select({ agencyId: jobsTable.agencyId }).from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (!assertTenantAccess(res, job.agencyId, getTenantAgencyId(req))) return;
  const [q] = await db.select({ id: jobScreeningQuestionsTable.id, jobId: jobScreeningQuestionsTable.jobId })
    .from(jobScreeningQuestionsTable).where(eq(jobScreeningQuestionsTable.id, qid));
  if (!q || q.jobId !== jobId) { res.status(404).json({ error: "Question not found" }); return; }
  await db.delete(jobScreeningQuestionsTable).where(eq(jobScreeningQuestionsTable.id, qid));
  res.json({ deleted: true });
});

// PATCH /jobs/:id/screening-questions/:qid/order — reorder a question (move up/down)
router.patch("/jobs/:id/screening-questions/:qid/order", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const jobId = parseInt(req.params.id ?? "");
  const qid = parseInt(req.params.qid ?? "");
  const { displayOrder } = req.body as { displayOrder?: number };
  if (isNaN(jobId) || isNaN(qid) || typeof displayOrder !== "number") {
    res.status(400).json({ error: "Invalid id or displayOrder" }); return;
  }
  const [job] = await db.select({ agencyId: jobsTable.agencyId }).from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (!assertTenantAccess(res, job.agencyId, getTenantAgencyId(req))) return;
  const [q] = await db.update(jobScreeningQuestionsTable)
    .set({ displayOrder })
    .where(and(eq(jobScreeningQuestionsTable.id, qid), eq(jobScreeningQuestionsTable.jobId, jobId)))
    .returning();
  if (!q) { res.status(404).json({ error: "Question not found" }); return; }
  res.json(q);
});

export default router;
