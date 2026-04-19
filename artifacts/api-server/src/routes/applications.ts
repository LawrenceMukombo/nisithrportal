import express, { Router, type IRouter } from "express";
import multer from "multer";
import { eq, and, inArray, asc, gt, desc, or, ilike, sql, ne } from "drizzle-orm";
import { z } from "zod/v4";
import {
  db,
  applicationsTable,
  applicationStatusHistoryTable,
  applicationDocumentsTable,
  applicationDraftTable,
  candidatesTable,
  candidateEducationTable,
  candidateExperienceTable,
  candidateLanguagesTable,
  candidateRefereesTable,
  candidateDiversityTable,
  candidateSkillsTable,
  jobsTable,
  notificationsTable,
  agenciesTable,
} from "@workspace/db";
import { applicationScreeningAnswersTable, jobScreeningQuestionsTable } from "@workspace/db";
import {
  GetApplicationsQueryParams,
  CreateApplicationBody,
  GetApplicationParams,
  UpdateApplicationStatusParams,
  UpdateApplicationStatusBody,
} from "@workspace/api-zod";
import { authMiddleware, optionalAuth, requireRole, parseIntParam } from "../middlewares/auth";
import { getTenantAgencyId, assertTenantAccess } from "../middlewares/tenant";
import { createNotification, getUserIdByEmail, notifyHrOfficers } from "../lib/notificationService";
import { autoParseCvBackground } from "../lib/cvParser";
import { ObjectStorageService } from "../lib/objectStorage";
import { canAccessObjectForAgency, setObjectAclPolicy } from "../lib/objectAcl";
const router: IRouter = Router();

// Convert empty strings to null (for optional DB fields where empty string ≠ null)
const orNull = (v: string | null | undefined): string | null =>
  v === "" || v == null ? null : v;

// Extended application body — superset of CreateApplicationBody with all wizard fields
const ExtendedApplicationBody = z.object({
  jobId: z.number().int(),
  // Personal info (Step 1)
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  otherNames: z.string().optional(),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  nationality: z.string().optional(),
  nationalId: z.string().optional(),
  maritalStatus: z.string().optional(),
  // Contact info (Step 2)
  candidateEmail: z.string().email(),
  candidatePhone: z.string().optional(),
  alternativePhone: z.string().optional(),
  physicalAddress: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  postalAddress: z.string().optional(),
  // Position & availability (Step 3)
  preferredLocation: z.string().optional(),
  availability: z.string().optional(),
  relocate: z.boolean().optional(),
  workType: z.string().optional(),
  // Education (Step 4) — array
  education: z.array(z.object({
    institution: z.string(),
    level: z.string().optional(),
    qualification: z.string().optional(),
    fieldOfStudy: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    current: z.boolean().optional(),
    certifications: z.string().optional(),
  })).optional(),
  // Work experience (Step 4) — array
  experience: z.array(z.object({
    employer: z.string(),
    jobTitle: z.string().optional(),
    responsibilities: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    current: z.boolean().optional(),
    reasonForLeaving: z.string().optional(),
    keyAchievements: z.string().optional(),
  })).optional(),
  // Skills (Step 5)
  technicalSkills: z.array(z.string()).optional(),
  softSkills: z.array(z.string()).optional(),
  languages: z.array(z.object({ language: z.string(), proficiency: z.string().optional() })).optional(),
  computerLiteracy: z.string().optional(),
  certificationsLicenses: z.string().optional(),
  personalStatement: z.string().optional(),
  coverLetter: z.string().optional(),
  // Documents (Step 6)
  cvUrl: z.string().optional(),
  documents: z.array(z.object({
    documentType: z.string(),
    url: z.string(),
    fileName: z.string().optional(),
  })).optional(),
  // Screening answers (Step 7)
  screeningAnswers: z.array(z.object({
    questionId: z.number().int(),
    answer: z.string().optional(),
  })).optional(),
  // References & compensation (Step 8)
  referees: z.array(z.object({
    name: z.string(),
    relationship: z.string().optional(),
    organisation: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
  })).optional(),
  expectedSalary: z.string().optional(),
  currentSalary: z.string().optional(),
  noticePeriod: z.string().optional(),
  // Declarations (Step 8)
  declarationAgreed: z.boolean().optional(),
  backgroundCheckConsent: z.boolean().optional(),
  conflictOfInterest: z.boolean().optional(),
  criminalRecord: z.boolean().optional(),
  dataPrivacyConsent: z.boolean().optional(),
  // D&I (optional)
  diversityInfo: z.object({
    disabilityStatus: z.string().optional(),
    genderIdentity: z.string().optional(),
    ethnicity: z.string().optional(),
  }).optional(),
});

const INTERNAL_OBJECT_PREFIX = "/api/storage/objects/";

async function getJobAgencyId(jobId: number): Promise<number | null> {
  const [job] = await db.select({ agencyId: jobsTable.agencyId }).from(jobsTable).where(eq(jobsTable.id, jobId));
  return job?.agencyId ?? null;
}

router.get("/applications", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const query = GetApplicationsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query parameters", details: query.error.issues });
    return;
  }
  const agencyId = getTenantAgencyId(req);
  const conditions = [];

  if (agencyId != null) {
    conditions.push(inArray(applicationsTable.jobId,
      db.select({ id: jobsTable.id }).from(jobsTable).where(eq(jobsTable.agencyId, agencyId)),
    ));
  }
  if (query.data.job_id != null) conditions.push(eq(applicationsTable.jobId, query.data.job_id));
  if (query.data.candidate_id != null) conditions.push(eq(applicationsTable.candidateId, query.data.candidate_id));
  if (query.data.status != null) conditions.push(eq(applicationsTable.status, query.data.status));

  const allApps = conditions.length > 0
    ? await db.select().from(applicationsTable).where(and(...conditions)).orderBy(applicationsTable.createdAt)
    : await db.select().from(applicationsTable).orderBy(applicationsTable.createdAt);

  const appIds = allApps.map((a) => a.id);
  const historyRows = appIds.length > 0
    ? await db.select().from(applicationStatusHistoryTable)
        .where(inArray(applicationStatusHistoryTable.applicationId, appIds))
        .orderBy(asc(applicationStatusHistoryTable.changedAt))
    : [];

  const historyByApp: Record<number, typeof historyRows> = {};
  for (const row of historyRows) {
    (historyByApp[row.applicationId] ??= []).push(row);
  }

  res.json(allApps.map((a) => ({ ...a, statusHistory: historyByApp[a.id] ?? [] })));
});

// GET /applications/ids — returns only IDs for the matching filter set (used by bulk "select all results")
router.get("/applications/ids", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const status = typeof req.query.status === "string" && req.query.status !== "all" ? req.query.status : null;
  const search = typeof req.query.search === "string" && req.query.search.trim() ? req.query.search.trim().toLowerCase() : null;

  const agencyId = getTenantAgencyId(req);
  const baseConditions = [];

  if (agencyId != null) {
    baseConditions.push(inArray(applicationsTable.jobId,
      db.select({ id: jobsTable.id }).from(jobsTable).where(eq(jobsTable.agencyId, agencyId)),
    ));
  }
  if (status != null) baseConditions.push(eq(applicationsTable.status, status));

  let rows: { id: number }[];
  if (search) {
    const pattern = `%${search}%`;
    const searchCondition = or(
      ilike(candidatesTable.name, pattern),
      ilike(jobsTable.title, pattern),
      sql`CAST(${applicationsTable.id} AS TEXT) LIKE ${pattern}`,
      sql`CAST(${applicationsTable.jobId} AS TEXT) LIKE ${pattern}`,
      sql`CAST(${applicationsTable.candidateId} AS TEXT) LIKE ${pattern}`,
    );
    const allConditions = searchCondition ? [...baseConditions, searchCondition] : baseConditions;
    const q = db
      .select({ id: applicationsTable.id })
      .from(applicationsTable)
      .leftJoin(candidatesTable, eq(applicationsTable.candidateId, candidatesTable.id))
      .leftJoin(jobsTable, eq(applicationsTable.jobId, jobsTable.id));
    rows = allConditions.length > 0 ? await q.where(and(...allConditions)) : await q;
  } else {
    const q = db.select({ id: applicationsTable.id }).from(applicationsTable);
    rows = baseConditions.length > 0 ? await q.where(and(...baseConditions)) : await q;
  }

  const ids = rows.map((r) => r.id);
  res.json({ ids, total: ids.length });
});

router.get("/applications/my", authMiddleware, async (req, res): Promise<void> => {
  const userId = req.user?.userId;
  const userEmail = req.user?.email;
  if (!userId && !userEmail) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // #76 Primary: look up candidates linked to this user account (fast indexed lookup)
  let candidateIdRows: { id: number }[] = [];
  if (userId != null) {
    candidateIdRows = await db.select({ id: candidatesTable.id })
      .from(candidatesTable)
      .where(eq(candidatesTable.userId, userId));
  }

  // Fallback: legacy email-based match for candidates submitted before account linking
  if (candidateIdRows.length === 0 && userEmail) {
    candidateIdRows = await db.select({ id: candidatesTable.id })
      .from(candidatesTable)
      .where(eq(candidatesTable.email, userEmail));
  }

  if (candidateIdRows.length === 0) {
    res.json([]);
    return;
  }

  const candidateIds = candidateIdRows.map((c) => c.id);
  const apps = await db.select()
    .from(applicationsTable)
    .where(inArray(applicationsTable.candidateId, candidateIds))
    .orderBy(applicationsTable.createdAt);

  const appIds = apps.map((a) => a.id);
  const historyRows = appIds.length > 0
    ? await db.select().from(applicationStatusHistoryTable)
        .where(inArray(applicationStatusHistoryTable.applicationId, appIds))
        .orderBy(asc(applicationStatusHistoryTable.changedAt))
    : [];

  const historyByApp: Record<number, typeof historyRows> = {};
  for (const row of historyRows) {
    (historyByApp[row.applicationId] ??= []).push(row);
  }

  res.json(apps.map((a) => ({ ...a, statusHistory: historyByApp[a.id] ?? [] })));
});

// Helper: Verify a user can access a draft for a given jobId
// - Candidates can only access their own email's draft
// - HR officers must belong to the same agency as the job
// - Admins can access any draft
async function assertDraftAccess(
  res: import("express").Response,
  user: { roleName: string | null; email?: string | null; agencyId?: number | null },
  jobId: number,
  email: string,
): Promise<boolean> {
  if (user.roleName === "admin") return true;
  if (user.roleName === "hr_officer") {
    const [job] = await db.select({ agencyId: jobsTable.agencyId }).from(jobsTable).where(eq(jobsTable.id, jobId));
    if (!job) { res.status(404).json({ error: "Job not found" }); return false; }
    if (!user.agencyId || user.agencyId !== job.agencyId) { res.status(403).json({ error: "Forbidden: cross-tenant access denied" }); return false; }
    return true;
  }
  // Candidate/public: email must match their own
  if (user.email?.toLowerCase() !== email.toLowerCase()) {
    res.status(403).json({ error: "Forbidden: email mismatch" }); return false;
  }
  return true;
}

// Draft save endpoint (POST /applications/draft/:jobId) — requires auth to protect PII
router.post("/applications/draft/:jobId", authMiddleware, async (req, res): Promise<void> => {
  const jobId = parseInt(req.params.jobId as string ?? "");
  const { candidateEmail, draftData, currentStep } = req.body as {
    candidateEmail?: string; draftData?: unknown; currentStep?: number;
  };
  if (!candidateEmail || isNaN(jobId) || !draftData) {
    res.status(400).json({ error: "candidateEmail and draftData required" });
    return;
  }
  const user = req.user!;
  if (!await assertDraftAccess(res, user, jobId, candidateEmail)) return;
  const existing = await db.select({ id: applicationDraftTable.id })
    .from(applicationDraftTable)
    .where(and(eq(applicationDraftTable.candidateEmail, candidateEmail), eq(applicationDraftTable.jobId, jobId)));
  if (existing.length > 0) {
    await db.update(applicationDraftTable)
      .set({ draftData: draftData as Record<string, unknown>, currentStep: currentStep ?? 1 })
      .where(and(eq(applicationDraftTable.candidateEmail, candidateEmail), eq(applicationDraftTable.jobId, jobId)));
  } else {
    await db.insert(applicationDraftTable).values({
      candidateEmail,
      jobId,
      draftData: draftData as Record<string, unknown>,
      currentStep: currentStep ?? 1,
    });
  }
  res.json({ saved: true });
});

// Draft load endpoint (GET /applications/draft/:jobId?email=...) — requires auth
router.get("/applications/draft/:jobId", authMiddleware, async (req, res): Promise<void> => {
  const jobId = parseInt(req.params.jobId as string ?? "");
  const email = typeof req.query.email === "string" ? req.query.email : "";
  if (!email || isNaN(jobId)) {
    res.status(400).json({ error: "email and jobId required" });
    return;
  }
  const user = req.user!;
  if (!await assertDraftAccess(res, user, jobId, email)) return;
  const [draft] = await db.select().from(applicationDraftTable)
    .where(and(eq(applicationDraftTable.candidateEmail, email), eq(applicationDraftTable.jobId, jobId)));
  res.json(draft ?? null);
});

// Delete draft (POST-submission cleanup) — requires auth
router.delete("/applications/draft/:jobId", authMiddleware, async (req, res): Promise<void> => {
  const jobId = parseInt(req.params.jobId as string ?? "");
  const email = typeof req.query.email === "string" ? req.query.email : "";
  if (!email || isNaN(jobId)) {
    res.status(400).json({ error: "email and jobId required" }); return;
  }
  const user = req.user!;
  if (!await assertDraftAccess(res, user, jobId, email)) return;
  await db.delete(applicationDraftTable)
    .where(and(eq(applicationDraftTable.candidateEmail, email), eq(applicationDraftTable.jobId, jobId)));
  res.json({ deleted: true });
});

router.post("/applications", async (req, res): Promise<void> => {
  // Try the extended body first; fall back to basic body for backward compat
  const extended = ExtendedApplicationBody.safeParse(req.body);
  const basic = extended.success ? null : CreateApplicationBody.safeParse(req.body);
  if (!extended.success && !basic?.success) {
    res.status(400).json({ error: extended.error.message });
    return;
  }
  const data = (extended.success ? extended.data : basic?.data)!;
  const jobId = data.jobId;
  const candidateEmail = data.candidateEmail;
  const candidatePhone = data.candidatePhone;
  const rawCvUrl = data.cvUrl;
  const coverLetter = extended.success
    ? (extended.data.coverLetter ?? undefined)
    : ((data as { coverLetter?: string }).coverLetter ?? undefined);
  const candidateName = extended.success
    ? `${extended.data.firstName} ${extended.data.lastName}`.trim()
    : (data as { candidateName?: string }).candidateName ?? candidateEmail;

  const [jobExists] = await db.select({ id: jobsTable.id, status: jobsTable.status, closingDate: jobsTable.closingDate, agencyId: jobsTable.agencyId })
    .from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!jobExists || jobExists.status !== "published") {
    res.status(422).json({ error: "Job is not accepting applications" });
    return;
  }
  if (jobExists.closingDate != null && new Date(jobExists.closingDate) < new Date()) {
    res.status(422).json({ error: "Job closing date has passed" });
    return;
  }

  // Enforce required declaration agreements on full wizard submissions
  if (extended.success) {
    const ext = extended.data;
    if (!ext.declarationAgreed) {
      res.status(422).json({ error: "You must agree to the statutory declaration before submitting" });
      return;
    }
    if (!ext.backgroundCheckConsent) {
      res.status(422).json({ error: "You must consent to a background check before submitting" });
      return;
    }
    if (!ext.dataPrivacyConsent) {
      res.status(422).json({ error: "You must consent to data privacy terms before submitting" });
      return;
    }
    if (ext.conflictOfInterest !== true) {
      res.status(422).json({ error: "You must declare that you have no conflict of interest" });
      return;
    }
    if (ext.criminalRecord !== true) {
      res.status(422).json({ error: "You must declare that you have no relevant criminal record" });
      return;
    }
    // Enforce required screening question answers
    const requiredQuestions = await db
      .select({ id: jobScreeningQuestionsTable.id, question: jobScreeningQuestionsTable.question })
      .from(jobScreeningQuestionsTable)
      .where(and(eq(jobScreeningQuestionsTable.jobId, jobId), eq(jobScreeningQuestionsTable.required, true)));
    if (requiredQuestions.length > 0) {
      const answeredQuestionIds = new Set(
        (ext.screeningAnswers ?? [])
          .filter(a => a.answer != null && String(a.answer).trim() !== "")
          .map(a => a.questionId)
      );
      const missingRequired = requiredQuestions.filter(q => !answeredQuestionIds.has(q.id));
      if (missingRequired.length > 0) {
        res.status(422).json({
          error: `Please answer all required screening questions: ${missingRequired.map(q => q.question).join("; ")}`,
        });
        return;
      }
    }
  }

  // Validate caller-provided cvUrl to prevent IDOR via forged internal storage paths.
  // Internal storage paths must have an ACL policy owned by this job's agency.
  // Unvalidated or cross-agency paths are silently dropped (not stored or parsed).
  let cvUrl: string | null = rawCvUrl ?? null;
  if (cvUrl && cvUrl.startsWith(INTERNAL_OBJECT_PREFIX)) {
    try {
      const svc = new ObjectStorageService();
      const objectPath = "/objects/" + cvUrl.slice(INTERNAL_OBJECT_PREFIX.length);
      const file = await svc.getObjectEntityFile(objectPath);
      const allowed = await canAccessObjectForAgency(file, jobExists.agencyId ?? null);
      if (!allowed) {
        cvUrl = null;
      }
    } catch {
      cvUrl = null;
    }
  }

  const ext = extended.success ? extended.data : null;

  let [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.email, candidateEmail));
  if (!candidate) {
    [candidate] = await db.insert(candidatesTable).values({
      name: candidateName,
      email: candidateEmail,
      phone: candidatePhone ?? null,
      cvUrl: cvUrl ?? null,
      // Extended personal fields from wizard
      ...(ext ? {
        otherNames: orNull(ext.otherNames),
        gender: orNull(ext.gender),
        dateOfBirth: orNull(ext.dateOfBirth),
        nationality: orNull(ext.nationality),
        nationalId: orNull(ext.nationalId),
        maritalStatus: orNull(ext.maritalStatus),
        alternativePhone: orNull(ext.alternativePhone),
        physicalAddress: orNull(ext.physicalAddress),
        city: orNull(ext.city),
        province: orNull(ext.province),
        district: orNull(ext.district),
        postalAddress: orNull(ext.postalAddress),
      } : {}),
    }).returning();
  } else {
    // Update candidate record with the latest info for repeat applicants
    const updates: Record<string, unknown> = {};
    if (cvUrl) updates.cvUrl = cvUrl;
    if (candidatePhone && !candidate.phone) updates.phone = candidatePhone;
    if (ext) {
      const d = (v: string | null | undefined) => orNull(v);
      if (d(ext.gender)) updates.gender = d(ext.gender);
      if (d(ext.dateOfBirth)) updates.dateOfBirth = d(ext.dateOfBirth);
      if (d(ext.nationality)) updates.nationality = d(ext.nationality);
      if (d(ext.nationalId)) updates.nationalId = d(ext.nationalId);
      if (d(ext.maritalStatus)) updates.maritalStatus = d(ext.maritalStatus);
      if (d(ext.alternativePhone)) updates.alternativePhone = d(ext.alternativePhone);
      if (d(ext.physicalAddress)) updates.physicalAddress = d(ext.physicalAddress);
      if (d(ext.city)) updates.city = d(ext.city);
      if (d(ext.province)) updates.province = d(ext.province);
      if (d(ext.district)) updates.district = d(ext.district);
      if (d(ext.postalAddress)) updates.postalAddress = d(ext.postalAddress);
    }
    if (Object.keys(updates).length > 0) {
      [candidate] = await db.update(candidatesTable)
        .set(updates)
        .where(eq(candidatesTable.id, candidate.id))
        .returning();
    }
  }

  // Duplicate-application guard: block resubmission unless the previous application was withdrawn.
  // A withdrawn application is treated as closed by the applicant, so reapplication is permitted.
  const [activeExisting] = await db
    .select({ id: applicationsTable.id })
    .from(applicationsTable)
    .where(
      and(
        eq(applicationsTable.candidateId, candidate.id),
        eq(applicationsTable.jobId, jobId),
        ne(applicationsTable.status, "withdrawn"),
      )
    )
    .limit(1);
  if (activeExisting) {
    res.status(422).json({ error: "You have already applied to this position." });
    return;
  }

  const [application] = await db.insert(applicationsTable).values({
    jobId,
    candidateId: candidate.id,
    status: "applied",
    coverLetter: coverLetter ?? null,
    ...(ext ? {
      preferredLocation: orNull(ext.preferredLocation),
      availability: orNull(ext.availability),
      relocate: ext.relocate ?? null,
      workType: orNull(ext.workType),
      technicalSkills: ext.technicalSkills?.length ? ext.technicalSkills : null,
      softSkills: ext.softSkills?.length ? ext.softSkills : null,
      computerLiteracy: orNull(ext.computerLiteracy),
      certificationsLicenses: orNull(ext.certificationsLicenses),
      personalStatement: orNull(ext.personalStatement),
      expectedSalary: orNull(ext.expectedSalary),
      currentSalary: orNull(ext.currentSalary),
      noticePeriod: orNull(ext.noticePeriod),
      declarationAgreed: ext.declarationAgreed ?? null,
      backgroundCheckConsent: ext.backgroundCheckConsent ?? null,
      conflictOfInterest: ext.conflictOfInterest ?? null,
      criminalRecord: ext.criminalRecord ?? null,
      dataPrivacyConsent: ext.dataPrivacyConsent ?? null,
    } : {}),
  }).returning();

  await db.insert(applicationStatusHistoryTable).values({
    applicationId: application.id,
    status: "applied",
  });

  // Save extended sub-records (education, experience, languages, referees, docs, diversity)
  if (ext) {
    const promises: Promise<unknown>[] = [];
    if (ext.education?.length) {
      promises.push(db.insert(candidateEducationTable).values(
        ext.education.map(e => ({
          candidateId: candidate.id,
          institution: e.institution,
          level: orNull(e.level),
          qualification: orNull(e.qualification),
          fieldOfStudy: orNull(e.fieldOfStudy),
          startDate: orNull(e.startDate),
          endDate: orNull(e.endDate),
          current: e.current ?? false,
          certifications: orNull(e.certifications),
        }))
      ));
    }
    if (ext.experience?.length) {
      promises.push(db.insert(candidateExperienceTable).values(
        ext.experience.map(e => ({
          candidateId: candidate.id,
          employer: e.employer,
          jobTitle: orNull(e.jobTitle),
          responsibilities: orNull(e.responsibilities),
          startDate: orNull(e.startDate),
          endDate: orNull(e.endDate),
          current: e.current ?? false,
          reasonForLeaving: orNull(e.reasonForLeaving),
          keyAchievements: orNull(e.keyAchievements),
        }))
      ));
    }
    if (ext.languages?.length) {
      promises.push(db.insert(candidateLanguagesTable).values(
        ext.languages.map(l => ({ candidateId: candidate.id, language: l.language, proficiency: l.proficiency ?? null }))
      ));
    }
    if (ext.referees?.length) {
      promises.push(db.insert(candidateRefereesTable).values(
        ext.referees.map(r => ({ applicationId: application.id, ...r }))
      ));
    }
    if (ext.documents?.length) {
      promises.push(db.insert(applicationDocumentsTable).values(
        ext.documents.map(d => ({ applicationId: application.id, documentType: d.documentType, url: d.url, fileName: d.fileName ?? null }))
      ));
    }
    if (ext.diversityInfo && Object.values(ext.diversityInfo).some(Boolean)) {
      promises.push(db.insert(candidateDiversityTable).values({
        candidateId: candidate.id,
        disabilityStatus: ext.diversityInfo.disabilityStatus ?? null,
        genderIdentity: ext.diversityInfo.genderIdentity ?? null,
        ethnicity: ext.diversityInfo.ethnicity ?? null,
      }));
    }
    // Persist screening answers — link questionId to the new application
    if (ext.screeningAnswers?.length) {
      promises.push(db.insert(applicationScreeningAnswersTable).values(
        ext.screeningAnswers
          .filter(a => a.questionId != null && a.answer != null && a.answer !== "")
          .map(a => ({
            applicationId: application.id,
            questionId: a.questionId,
            answer: String(a.answer),
          }))
      ));
    }
    // Persist skills to the canonical candidate_skills table (normalised, one row per skill)
    const technicalSkillsList = ext.technicalSkills ?? [];
    const softSkillsList = ext.softSkills ?? [];
    const allSkillRows = [
      ...technicalSkillsList.map(s => ({ candidateId: candidate.id, skill: s, skillType: "technical" as const, applicationId: application.id })),
      ...softSkillsList.map(s => ({ candidateId: candidate.id, skill: s, skillType: "soft" as const, applicationId: application.id })),
    ];
    if (allSkillRows.length > 0) {
      promises.push(db.insert(candidateSkillsTable).values(allSkillRows));
    }
    // Use Promise.all so sub-record failures surface as errors (not silently swallowed)
    await Promise.all(promises);

    // Clear draft after successful submission
    try {
      await db.delete(applicationDraftTable)
        .where(and(eq(applicationDraftTable.candidateEmail, candidateEmail), eq(applicationDraftTable.jobId, jobId)));
    } catch { /* ignore */ }
  }

  res.status(201).json({ ...application, statusHistory: [{ id: 0, applicationId: application.id, status: "applied", changedAt: application.createdAt, note: null }] });

  // Notify the responsible HR officer (job poster) about the new application.
  // If the job has no assigned poster, fall back to all HR officers in the agency.
  try {
    const [job] = await db
      .select({ agencyId: jobsTable.agencyId, title: jobsTable.title, createdBy: jobsTable.createdBy })
      .from(jobsTable).where(eq(jobsTable.id, jobId));
    if (job?.agencyId != null) {
      const message = `New application received from ${candidateName} for "${job.title}".`;
      if (job.createdBy != null) {
        await createNotification({ userId: job.createdBy, type: "new_application", message });
      } else {
        await notifyHrOfficers(job.agencyId, "new_application", message);
      }
    }
  } catch (err) {
    console.error("[applications] New application HR notification failed:", err);
  }

  // Auto-parse CV in the background. Fire-and-forget: errors are swallowed.
  // Always re-parse when a new CV file was uploaded in this submission (cvUrl),
  // so returning candidates with a freshly uploaded document get updated parsed data.
  // For text-only submissions (no file), only parse on first application (no parsedData yet).
  const shouldParse = Boolean(cvUrl) || (!candidate.parsedData && Boolean(coverLetter));
  if (shouldParse) {
    void autoParseCvBackground(candidate.id, {
      cvUrl: cvUrl ?? null,
      fallbackText: coverLetter
        ? `Name: ${candidateName}\nEmail: ${candidateEmail}\n\n${coverLetter}`
        : null,
    });
  }
});

router.get("/applications/track", async (req, res): Promise<void> => {
  const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : "";
  const refId = parseInt(typeof req.query.ref === "string" ? req.query.ref : "", 10);

  if (!email || isNaN(refId)) {
    res.status(400).json({ error: "email and ref are required" });
    return;
  }

  const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, refId));
  if (!application) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  const [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, application.candidateId));
  if (!candidate || candidate.email.toLowerCase() !== email) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  const [job] = await db.select({ title: jobsTable.title })
    .from(jobsTable).where(eq(jobsTable.id, application.jobId));

  res.json({
    id: application.id,
    status: application.status,
    submittedAt: application.createdAt,
    jobTitle: job?.title ?? "Unknown Position",
    jobLocation: null,
  });
});

router.patch("/applications/:id", authMiddleware, requireRole("applicant"), async (req, res): Promise<void> => {
  const id = parseIntParam(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid application id" });
    return;
  }

  const { status } = req.body as { status?: string };
  if (status !== "withdrawn") {
    res.status(400).json({ error: "Only withdrawal is permitted via this endpoint" });
    return;
  }

  const userEmail = req.user?.email;
  if (!userEmail) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [existing] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Application not found" });
    return;
  }

  const [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, existing.candidateId));
  if (!candidate || candidate.email.toLowerCase() !== userEmail.toLowerCase()) {
    res.status(403).json({ error: "You can only withdraw your own applications" });
    return;
  }

  const terminalStatuses = ["rejected", "withdrawn", "hired"];
  if (terminalStatuses.includes(existing.status)) {
    res.status(422).json({ error: "This application cannot be withdrawn" });
    return;
  }

  const [application] = await db
    .update(applicationsTable)
    .set({ status: "withdrawn" })
    .where(eq(applicationsTable.id, id))
    .returning();

  await db.insert(applicationStatusHistoryTable).values({
    applicationId: application.id,
    status: "withdrawn",
    note: null,
  });

  const statusHistory = await db
    .select()
    .from(applicationStatusHistoryTable)
    .where(eq(applicationStatusHistoryTable.applicationId, application.id))
    .orderBy(asc(applicationStatusHistoryTable.changedAt));

  res.json({ ...application, statusHistory });

  // Notify the responsible HR officer (job poster) about the withdrawal.
  // If the job has no assigned poster, fall back to all HR officers in the agency.
  try {
    const [job] = await db
      .select({ agencyId: jobsTable.agencyId, title: jobsTable.title, createdBy: jobsTable.createdBy })
      .from(jobsTable)
      .where(eq(jobsTable.id, existing.jobId));
    if (job?.agencyId != null) {
      const candidateName = candidate.name ?? candidate.email;
      const message = `${candidateName} has withdrawn their application for "${job.title}".`;
      if (job.createdBy != null) {
        await createNotification({ userId: job.createdBy, type: "application_withdrawn", message });
      } else {
        await notifyHrOfficers(job.agencyId, "application_withdrawn", message);
      }
    }
  } catch (err) {
    console.error("[applications] Withdrawal HR notification failed:", err);
  }
});

router.get("/applications/:id", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const params = GetApplicationParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid application id" });
    return;
  }
  const [application] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, params.data.id));
  if (!application) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  const agencyId = getTenantAgencyId(req);
  if (agencyId != null) {
    const jobAgencyId = await getJobAgencyId(application.jobId);
    if (!assertTenantAccess(res, jobAgencyId, agencyId)) return;
  }
  const statusHistory = await db.select().from(applicationStatusHistoryTable)
    .where(eq(applicationStatusHistoryTable.applicationId, application.id))
    .orderBy(asc(applicationStatusHistoryTable.changedAt));
  res.json({ ...application, statusHistory });
});

router.patch("/applications/:id/status", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const params = UpdateApplicationStatusParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid application id" });
    return;
  }
  const [existing] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  const agencyId = getTenantAgencyId(req);
  if (agencyId != null) {
    const jobAgencyId = await getJobAgencyId(existing.jobId);
    if (!assertTenantAccess(res, jobAgencyId, agencyId)) return;
  }
  const body = UpdateApplicationStatusBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  // Wrap update + history insert in a transaction so they are atomic.
  // `status` in the history table represents the destination (to-status).
  const application = await db.transaction(async (tx) => {
    const [updated] = await tx.update(applicationsTable)
      .set({
        status: body.data.status,
        notes: body.data.notes ?? undefined,
        score: body.data.score ?? undefined,
      })
      .where(eq(applicationsTable.id, params.data.id))
      .returning();

    if (body.data.status !== existing.status) {
      await tx.insert(applicationStatusHistoryTable).values({
        applicationId: updated.id,
        fromStatus: existing.status,
        status: body.data.status,
        note: body.data.notes ?? null,
      });
    }

    return updated;
  });

  // Trigger notification to applicant on status change
  if (body.data.status && body.data.status !== existing.status) {
    try {
      const [candidate] = await db.select({ email: candidatesTable.email })
        .from(candidatesTable)
        .where(eq(candidatesTable.id, existing.candidateId));
      if (candidate?.email) {
        const applicantUserId = await getUserIdByEmail(candidate.email);
        if (applicantUserId) {
          const statusLabel: Record<string, string> = {
            screening: "is being reviewed",
            interview: "has advanced to interview stage",
            offer: "has received a job offer",
            hired: "has been accepted — congratulations!",
            onboarding: "has started the onboarding process — welcome to the team!",
            rejected: "was not successful this time",
            withdrawn: "has been withdrawn",
          };
          const label = statusLabel[body.data.status] ?? `has been updated to "${body.data.status}"`;
          await createNotification({
            userId: applicantUserId,
            type: "application_status",
            message: `Your application ${label}.`,
          });
        }
      }
    } catch (err) {
      // Non-fatal — don't fail the status update if notification fails
      console.error("[applications] Notification trigger failed:", err);
    }
  }

  const statusHistory = await db.select().from(applicationStatusHistoryTable)
    .where(eq(applicationStatusHistoryTable.applicationId, application.id))
    .orderBy(asc(applicationStatusHistoryTable.changedAt));
  res.json({ ...application, statusHistory });
});

// GET /applications/:id/screening-answers — returns answers with question text, for HR view
router.get("/applications/:id/screening-answers", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const appId = parseIntParam(req.params.id);
  if (!appId) { res.status(400).json({ error: "Invalid application id" }); return; }

  // Verify application exists and apply tenant check
  const [row] = await db
    .select({ id: applicationsTable.id, agencyId: jobsTable.agencyId })
    .from(applicationsTable)
    .leftJoin(jobsTable, eq(applicationsTable.jobId, jobsTable.id))
    .where(eq(applicationsTable.id, appId));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const userAgencyId = getTenantAgencyId(req);
  if (!assertTenantAccess(res, row.agencyId, userAgencyId)) return;

  const answers = await db
    .select({
      id: applicationScreeningAnswersTable.id,
      questionId: applicationScreeningAnswersTable.questionId,
      answer: applicationScreeningAnswersTable.answer,
      question: jobScreeningQuestionsTable.question,
      questionType: jobScreeningQuestionsTable.questionType,
    })
    .from(applicationScreeningAnswersTable)
    .leftJoin(jobScreeningQuestionsTable, eq(applicationScreeningAnswersTable.questionId, jobScreeningQuestionsTable.id))
    .where(eq(applicationScreeningAnswersTable.applicationId, appId))
    .orderBy(asc(jobScreeningQuestionsTable.displayOrder));

  res.json(answers);
});

// GET /applications/:id/documents — returns uploaded documents for an application
router.get("/applications/:id/documents", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const appId = parseIntParam(req.params.id);
  if (!appId) { res.status(400).json({ error: "Invalid application id" }); return; }

  const [row] = await db
    .select({ id: applicationsTable.id, agencyId: jobsTable.agencyId })
    .from(applicationsTable)
    .leftJoin(jobsTable, eq(applicationsTable.jobId, jobsTable.id))
    .where(eq(applicationsTable.id, appId));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const userAgencyId = getTenantAgencyId(req);
  if (!assertTenantAccess(res, row.agencyId, userAgencyId)) return;

  const docs = await db.select().from(applicationDocumentsTable)
    .where(eq(applicationDocumentsTable.applicationId, appId))
    .orderBy(asc(applicationDocumentsTable.createdAt));
  res.json(docs);
});

// POST /applications/bulk-status — update status of multiple applications at once (#67)
router.post("/applications/bulk-status", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const body = z.object({
    ids: z.array(z.number().int().positive()).min(1).max(5000),
    status: z.string().min(1),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "ids (array) and status (string) required" }); return; }

  const { ids, status } = body.data;
  const ALLOWED_STATUSES = ["applied", "screening", "interview", "offer", "hired", "rejected", "onboarding"];
  if (!ALLOWED_STATUSES.includes(status)) { res.status(400).json({ error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(", ")}` }); return; }

  const userAgencyId = getTenantAgencyId(req);
  const apps = await db
    .select({ id: applicationsTable.id, agencyId: jobsTable.agencyId, status: applicationsTable.status })
    .from(applicationsTable)
    .leftJoin(jobsTable, eq(applicationsTable.jobId, jobsTable.id))
    .where(inArray(applicationsTable.id, ids));

  const allowedIds = apps
    .filter(a => userAgencyId === null || a.agencyId === userAgencyId)
    .filter(a => !["rejected", "withdrawn"].includes(a.status ?? ""))
    .map(a => a.id);

  if (allowedIds.length === 0) { res.json({ updated: 0 }); return; }

  await db
    .update(applicationsTable)
    .set({ status, updatedAt: new Date() })
    .where(inArray(applicationsTable.id, allowedIds));

  await db.insert(applicationStatusHistoryTable).values(
    allowedIds.map(id => ({ applicationId: id, status, changedBy: req.user?.id ?? null }))
  );

  res.json({ updated: allowedIds.length });
});

// POST /applications/:id/documents — upload a document (e.g. signed contract) for an application (#58)
const contractUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ALLOWED = new Set([
      "application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg", "image/png",
    ]);
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new Error("Unsupported file type. Allowed: PDF, DOC, DOCX, JPG, PNG"));
  },
});

router.post("/applications/:id/documents", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), (req, res): void => {
  contractUpload.single("file")(req, res, async (err) => {
    if (err) {
      res.status(400).json({ error: err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE" ? "File too large (max 15 MB)" : (err as Error).message });
      return;
    }
    if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

    const appId = parseIntParam(req.params.id);
    if (!appId) { res.status(400).json({ error: "Invalid application id" }); return; }

    const documentType = typeof req.body?.documentType === "string" ? req.body.documentType : "signed_contract";

    const [appRow] = await db
      .select({ id: applicationsTable.id, agencyId: jobsTable.agencyId })
      .from(applicationsTable)
      .leftJoin(jobsTable, eq(applicationsTable.jobId, jobsTable.id))
      .where(eq(applicationsTable.id, appId));
    if (!appRow) { res.status(404).json({ error: "Application not found" }); return; }
    if (!assertTenantAccess(res, appRow.agencyId, getTenantAgencyId(req))) return;

    const svc = new ObjectStorageService();
    let fileUrl: string;
    try {
      const uploadURL = await svc.getObjectEntityUploadURL();
      const objectPath = svc.normalizeObjectEntityPath(uploadURL);
      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": req.file.mimetype },
        body: new Uint8Array(req.file.buffer),
      });
      if (!uploadRes.ok) { res.status(500).json({ error: "Failed to store file" }); return; }
      const objectFile = await svc.getObjectEntityFile(objectPath);
      await setObjectAclPolicy(objectFile, { owner: String(appRow.agencyId), visibility: "private" });
      fileUrl = `/api/storage${objectPath}`;
    } catch (uploadErr) {
      req.log.error({ err: uploadErr }, "Document upload to storage failed");
      res.status(500).json({ error: "Failed to upload file to storage" });
      return;
    }

    const [doc] = await db.insert(applicationDocumentsTable).values({
      applicationId: appId,
      documentType,
      url: fileUrl,
      fileName: req.file.originalname,
    }).returning();

    res.status(201).json(doc);
  });
});

// GET /jobs/:id/di-report — aggregate D&I statistics for a job (no individual data exposed)
router.get("/jobs/:id/di-report", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const jobId = parseIntParam(req.params.id);
  if (!jobId) { res.status(400).json({ error: "Invalid job id" }); return; }

  const [job] = await db.select({ agencyId: jobsTable.agencyId }).from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (!assertTenantAccess(res, job.agencyId, getTenantAgencyId(req))) return;

  // Get all applications for this job
  const apps = await db.select({ id: applicationsTable.id, candidateId: applicationsTable.candidateId })
    .from(applicationsTable)
    .where(eq(applicationsTable.jobId, jobId));

  if (apps.length === 0) {
    res.json({ total: 0, optInCount: 0, disabilityStatus: {}, genderIdentity: {}, ethnicity: {} });
    return;
  }

  const candidateIds = apps.map(a => a.candidateId).filter((id): id is number => id !== null);

  const divRows = candidateIds.length > 0
    ? await db.select().from(candidateDiversityTable).where(inArray(candidateDiversityTable.candidateId, candidateIds))
    : [];

  // Aggregate counts
  const disabilityStatus: Record<string, number> = {};
  const genderIdentity: Record<string, number> = {};
  const ethnicity: Record<string, number> = {};

  for (const row of divRows) {
    if (row.disabilityStatus) disabilityStatus[row.disabilityStatus] = (disabilityStatus[row.disabilityStatus] ?? 0) + 1;
    if (row.genderIdentity) genderIdentity[row.genderIdentity] = (genderIdentity[row.genderIdentity] ?? 0) + 1;
    if (row.ethnicity) ethnicity[row.ethnicity] = (ethnicity[row.ethnicity] ?? 0) + 1;
  }

  res.json({
    total: apps.length,
    optInCount: divRows.length,
    disabilityStatus,
    genderIdentity,
    ethnicity,
  });
});

const DEFAULT_STALE_THRESHOLDS: Record<string, number> = {
  applied:    3,
  screening:  7,
  interview:  10,
  offer:      5,
  hired:      7,
  onboarding: 14,
};
const TERMINAL_STATUSES_SET = new Set(["rejected", "withdrawn"]);

async function getStaleThresholds(agencyId: number): Promise<Record<string, number>> {
  const [agency] = await db.select({ configuration: agenciesTable.configuration })
    .from(agenciesTable).where(eq(agenciesTable.id, agencyId));
  const saved = (agency?.configuration as { staleThresholds?: Record<string, number> } | null)?.staleThresholds ?? {};
  return { ...DEFAULT_STALE_THRESHOLDS, ...saved };
}

// POST /applications/check-stalled — scan all active applications and create
// in-app notifications for HR officers when any are stuck beyond their stage threshold.
// Deduplicates: skips applications that already have an `application_stalled`
// notification created within the last 24 hours.
router.post("/applications/check-stalled", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const agencyId = getTenantAgencyId(req);
  if (!agencyId) { res.status(403).json({ error: "Agency context required" }); return; }

  // Fetch non-terminal applications for this agency with their status history
  const apps = await db
    .select({
      id:        applicationsTable.id,
      status:    applicationsTable.status,
      createdAt: applicationsTable.createdAt,
      jobId:     applicationsTable.jobId,
    })
    .from(applicationsTable)
    .innerJoin(jobsTable, eq(applicationsTable.jobId, jobsTable.id))
    .where(eq(jobsTable.agencyId, agencyId));

  const staleThresholds = await getStaleThresholds(agencyId);
  const activeApps = apps.filter((a) => !TERMINAL_STATUSES_SET.has(a.status ?? ""));
  if (activeApps.length === 0) { res.json({ notified: 0 }); return; }

  const appIds = activeApps.map((a) => a.id);
  const histories = await db
    .select()
    .from(applicationStatusHistoryTable)
    .where(inArray(applicationStatusHistoryTable.applicationId, appIds))
    .orderBy(asc(applicationStatusHistoryTable.changedAt));

  // Build a map: appId → latest statusHistory entry for its current status
  const historyByApp = new Map<number, { changedAt: Date | null }>();
  for (const h of histories) {
    const app = activeApps.find((a) => a.id === h.applicationId);
    if (!app || h.status !== (app.status ?? "")) continue;
    const existing = historyByApp.get(h.applicationId);
    const hTime = h.changedAt ? new Date(h.changedAt).getTime() : 0;
    const eTime = existing?.changedAt ? new Date(existing.changedAt).getTime() : 0;
    if (!existing || hTime > eTime) historyByApp.set(h.applicationId, h);
  }

  const now = Date.now();
  const stalledApps = activeApps.filter((app) => {
    const threshold = staleThresholds[app.status ?? ""] ?? 7;
    const entry = historyByApp.get(app.id);
    const entryTime = entry?.changedAt ? new Date(entry.changedAt).getTime() : (app.createdAt ? new Date(app.createdAt).getTime() : now);
    const days = Math.max(0, Math.floor((now - entryTime) / (1000 * 60 * 60 * 24)));
    return days >= threshold;
  });

  if (stalledApps.length === 0) { res.json({ notified: 0 }); return; }

  // Deduplicate: find stalled app IDs that already have a notification in the last 24h
  const cutoff = new Date(now - 24 * 60 * 60 * 1000);
  const recentNotifs = await db
    .select({ message: notificationsTable.message })
    .from(notificationsTable)
    .where(and(
      eq(notificationsTable.type, "application_stalled"),
      gt(notificationsTable.createdAt, cutoff)
    ));

  const recentlyNotifiedAppIds = new Set<number>();
  for (const n of recentNotifs) {
    const match = n.message.match(/application #(\d+)/i);
    if (match) recentlyNotifiedAppIds.add(Number(match[1]));
  }

  const toNotify = stalledApps.filter((a) => !recentlyNotifiedAppIds.has(a.id));
  if (toNotify.length === 0) { res.json({ notified: 0 }); return; }

  let notifiedCount = 0;
  for (const app of toNotify) {
    const threshold = staleThresholds[app.status ?? ""] ?? 7;
    const entry = historyByApp.get(app.id);
    const entryTime = entry?.changedAt ? new Date(entry.changedAt).getTime() : (app.createdAt ? new Date(app.createdAt).getTime() : now);
    const days = Math.max(0, Math.floor((now - entryTime) / (1000 * 60 * 60 * 24)));
    const message = `Application #${app.id} has been in "${app.status}" for ${days} day${days !== 1 ? "s" : ""} (threshold: ${threshold}d). Please review.`;
    await notifyHrOfficers(agencyId, "application_stalled", message);
    notifiedCount++;
  }

  res.json({ notified: notifiedCount });
});

export default router;
