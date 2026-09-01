import { Router, type IRouter } from "express";
import { eq, and, inArray, asc, or, isNull, sql } from "drizzle-orm";
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
import { NISIT_AGENCY_ID } from "../lib/single-tenant";

const router: IRouter = Router();

const STAFF_ROLES = ["admin", "hr_officer", "manager"] as const;
function isInternalStaff(user: { roleName?: string | null } | undefined | null): boolean {
  return user?.roleName != null && (STAFF_ROLES as readonly string[]).includes(user.roleName);
}

const PUBLIC_TARGET_FILTER = or(isNull(jobsTable.publishTarget), inArray(jobsTable.publishTarget, ["public", "both"]))!;

router.get("/jobs", optionalAuth, async (req, res): Promise<void> => {
  const query = GetJobsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query parameters", details: query.error.issues });
    return;
  }
  const conditions = [];
  const isAuthenticated = req.user != null;
  const isStaff = isInternalStaff(req.user);

  // Single-tenant mode: every job listing is hard-scoped to the NISIT agency.
  conditions.push(eq(jobsTable.agencyId, NISIT_AGENCY_ID));

  if (!isAuthenticated || !isStaff) {
    if (query.data.status != null) {
      if (query.data.status === "open" || query.data.status === "published") {
        conditions.push(inArray(jobsTable.status, ["open", "published"]));
      } else {
        conditions.push(eq(jobsTable.status, query.data.status));
      }
    } else {
      conditions.push(inArray(jobsTable.status, ["open", "published"]));
    }
    // Only show unexpired jobs to public / non-staff users
    conditions.push(or(isNull(jobsTable.closingDate), sql`DATE(${jobsTable.closingDate}) >= CURRENT_DATE`)!);
    conditions.push(PUBLIC_TARGET_FILTER);
  } else if (query.data.status != null) {
    if (query.data.status === "open" || query.data.status === "published") {
      conditions.push(inArray(jobsTable.status, ["open", "published"]));
    } else {
      conditions.push(eq(jobsTable.status, query.data.status));
    }
  }

  if (query.data.department_id != null) conditions.push(eq(jobsTable.departmentId, query.data.department_id));

  const jobs = conditions.length > 0
    ? await db.select().from(jobsTable).where(and(...conditions)).orderBy(jobsTable.createdAt)
    : await db.select().from(jobsTable).orderBy(jobsTable.createdAt);
  res.json(jobs);
});

function extractJobFields(data: typeof CreateJobBody._type | typeof UpdateJobBody._type) {
  return {
    title: data.title,
    description: data.description,
    departmentId: data.departmentId ?? null,
    status: "status" in data ? (data.status ?? undefined) : undefined,
    closingDate: data.closingDate ?? null,
    referenceNumber: data.referenceNumber ?? null,
    country: data.country ?? null,
    province: data.province ?? null,
    officeSite: data.officeSite ?? null,
    location: data.location ?? null,
    publishTarget: data.publishTarget ?? null,
    autoExpire: data.autoExpire ?? null,
    employmentType: data.employmentType ?? null,
    workArrangement: data.workArrangement ?? null,
    jobSummary: data.jobSummary ?? null,
    responsibilities: data.responsibilities ?? null,
    reportingLine: data.reportingLine ?? null,
    minEducation: data.minEducation ?? null,
    yearsExperience: data.yearsExperience ?? null,
    technicalSkills: data.technicalSkills ?? null,
    softSkills: data.softSkills ?? null,
    certifications: data.certifications ?? null,
    languageRequirements: data.languageRequirements ?? null,
    salaryMin: data.salaryMin ?? null,
    salaryMax: data.salaryMax ?? null,
    salaryCurrency: data.salaryCurrency ?? null,
    salaryVisibility: data.salaryVisibility ?? null,
    gradeBand: data.gradeBand ?? null,
    contractDuration: data.contractDuration ?? null,
    openingDate: data.openingDate ?? null,
    requiredDocuments: data.requiredDocuments ?? null,
    maxApplicants: data.maxApplicants ?? null,
    isFeatured: data.isFeatured ?? null,
  };
}

router.post("/jobs", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!parsed.data.employmentType) {
    res.status(400).json({ error: "Employment type is required" });
    return;
  }
  if (!parsed.data.province) {
    res.status(400).json({ error: "Province is required" });
    return;
  }
  // Single-tenant mode: every new job belongs to NISIT, regardless of caller payload/scope.
  const agencyId = NISIT_AGENCY_ID;
  if (parsed.data.departmentId != null) {
    const dept = await db.select({ agencyId: departmentsTable.agencyId }).from(departmentsTable).where(eq(departmentsTable.id, parsed.data.departmentId)).then((r) => r[0]);
    if (!assertTenantAccess(res, dept?.agencyId ?? null, agencyId)) return;
  }
  const fields = extractJobFields(parsed.data);
  const [job] = await db.insert(jobsTable).values({
    ...fields,
    status: parsed.data.status ?? "draft",
    agencyId,
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
  const isPublicTarget = !job.publishTarget || job.publishTarget === "public" || job.publishTarget === "both";
  const canViewInternal = isInternalStaff(req.user) && isOwnAgency;
  const isPastClosing = job.closingDate != null && new Date(job.closingDate).setHours(23, 59, 59, 999) < Date.now();

  if (!canViewInternal) {
    if (!isPublished || !isPublicTarget || isPastClosing) {
      res.status(req.user ? 403 : 404).json({ error: "Job vacancy has closed or is no longer available" });
      return;
    }
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
  const fields = extractJobFields(body.data);
  const [job] = await db.update(jobsTable).set({
    ...fields,
    status: body.data.status ?? existing.status,
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
  const missingFields: string[] = [];
  if (!existing.employmentType) missingFields.push("employmentType");
  if (!existing.province) missingFields.push("province");
  if (missingFields.length > 0) {
    res.status(400).json({
      error: `Cannot publish job: missing required field(s): ${missingFields.join(", ")}`,
      missingFields,
    });
    return;
  }
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
  isMandatoryFilter: z.boolean().default(false),
  autoReject: z.boolean().default(false),
  autoRejectValue: z.string().optional(),
  displayOrder: z.number().int().optional(),
});

router.get("/jobs/:id/screening-questions", optionalAuth, async (req, res): Promise<void> => {
  const jobId = parseInt(req.params.id as string);
  if (isNaN(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }
  const [job] = await db.select({ status: jobsTable.status, agencyId: jobsTable.agencyId, publishTarget: jobsTable.publishTarget }).from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  const isPublishedStatus = job.status === "open" || job.status === "published";
  const isPublicTarget = !job.publishTarget || job.publishTarget === "public" || job.publishTarget === "both";
  const isSameAgencyStaff = isInternalStaff(req.user) && req.user?.agencyId != null && req.user.agencyId === job.agencyId;

  if (!isPublishedStatus) {
    if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
    const userAgencyId = getTenantAgencyId(req);
    if (userAgencyId !== job.agencyId) {
      res.status(403).json({ error: "Forbidden" }); return;
    }
  } else if (!isPublicTarget && !isSameAgencyStaff) {
    res.status(req.user ? 403 : 404).json({ error: "Job not found" }); return;
  }
  const questions = await db.select().from(jobScreeningQuestionsTable)
    .where(eq(jobScreeningQuestionsTable.jobId, jobId))
    .orderBy(asc(jobScreeningQuestionsTable.displayOrder));
  res.json(questions);
});

router.post("/jobs/:id/screening-questions", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const jobId = parseInt(req.params.id as string);
  if (isNaN(jobId)) { res.status(400).json({ error: "Invalid job id" }); return; }
  const parsed = ScreeningQuestionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [job] = await db.select({ agencyId: jobsTable.agencyId }).from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (!assertTenantAccess(res, job.agencyId, getTenantAgencyId(req))) return;
  const [q] = await db.insert(jobScreeningQuestionsTable).values({
    jobId,
    question: parsed.data.question,
    questionType: parsed.data.questionType,
    options: parsed.data.options ?? null,
    required: parsed.data.required,
    isMandatoryFilter: parsed.data.isMandatoryFilter,
    autoReject: parsed.data.autoReject,
    autoRejectValue: parsed.data.autoRejectValue ?? null,
    displayOrder: parsed.data.displayOrder ?? 0,
  }).returning();
  res.status(201).json(q);
});

router.delete("/jobs/:id/screening-questions/:qid", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const jobId = parseInt(req.params.id as string);
  const qid = parseInt(req.params.qid as string);
  if (isNaN(jobId) || isNaN(qid)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [job] = await db.select({ agencyId: jobsTable.agencyId }).from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (!assertTenantAccess(res, job.agencyId, getTenantAgencyId(req))) return;
  const [q] = await db.select({ id: jobScreeningQuestionsTable.id, jobId: jobScreeningQuestionsTable.jobId })
    .from(jobScreeningQuestionsTable).where(eq(jobScreeningQuestionsTable.id, qid));
  if (!q || q.jobId !== jobId) { res.status(404).json({ error: "Question not found" }); return; }
  await db.delete(jobScreeningQuestionsTable).where(eq(jobScreeningQuestionsTable.id, qid));
  res.json({ deleted: true });
});

router.patch("/jobs/:id/screening-questions/:qid/order", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const jobId = parseInt(req.params.id as string);
  const qid = parseInt(req.params.qid as string);
  const { direction } = req.body as { direction?: string };
  if (isNaN(jobId) || isNaN(qid) || (direction !== "up" && direction !== "down")) {
    res.status(400).json({ error: "Invalid id or direction (must be 'up' or 'down')" }); return;
  }
  const [job] = await db.select({ agencyId: jobsTable.agencyId }).from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (!assertTenantAccess(res, job.agencyId, getTenantAgencyId(req))) return;

  const allQuestions = await db.select().from(jobScreeningQuestionsTable)
    .where(eq(jobScreeningQuestionsTable.jobId, jobId))
    .orderBy(asc(jobScreeningQuestionsTable.displayOrder));

  const idx = allQuestions.findIndex(q => q.id === qid);
  if (idx === -1) { res.status(404).json({ error: "Question not found" }); return; }

  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= allQuestions.length) {
    res.status(400).json({ error: "Cannot move question in that direction" }); return;
  }

  const current = allQuestions[idx];
  const target = allQuestions[targetIdx];
  if (!current || !target) { res.status(500).json({ error: "Question lookup failed" }); return; }

  const currentOrder = current.displayOrder;
  const targetOrder = target.displayOrder;

  await db.update(jobScreeningQuestionsTable).set({ displayOrder: targetOrder }).where(eq(jobScreeningQuestionsTable.id, current.id));
  await db.update(jobScreeningQuestionsTable).set({ displayOrder: currentOrder }).where(eq(jobScreeningQuestionsTable.id, target.id));

  res.json({ success: true, movedId: qid, direction });
});

export default router;
