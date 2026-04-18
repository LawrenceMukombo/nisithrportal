import express, { Router, type IRouter } from "express";
import { eq, and, inArray, asc } from "drizzle-orm";
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
  jobsTable,
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
import { canAccessObjectForAgency } from "../lib/objectAcl";
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

router.get("/applications/my", authMiddleware, async (req, res): Promise<void> => {
  const userEmail = req.user?.email;
  if (!userEmail) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const candidates = await db.select({ id: candidatesTable.id })
    .from(candidatesTable)
    .where(eq(candidatesTable.email, userEmail));

  if (candidates.length === 0) {
    res.json([]);
    return;
  }

  const candidateIds = candidates.map((c) => c.id);
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

// Draft save endpoint (POST /applications/draft) — requires auth to protect PII
router.post("/applications/draft", authMiddleware, async (req, res): Promise<void> => {
  const { candidateEmail, jobId, draftData, currentStep } = req.body as {
    candidateEmail?: string; jobId?: number; draftData?: unknown; currentStep?: number;
  };
  if (!candidateEmail || !jobId || !draftData) {
    res.status(400).json({ error: "candidateEmail, jobId, and draftData required" });
    return;
  }
  const user = req.user!;
  // Non-admin/hr users may only save drafts for their own email
  if (user.role !== "admin" && user.role !== "hr_officer") {
    if (user.email?.toLowerCase() !== candidateEmail.toLowerCase()) {
      res.status(403).json({ error: "Forbidden: email mismatch" }); return;
    }
  }
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
  const jobId = parseInt(req.params.jobId ?? "");
  const email = typeof req.query.email === "string" ? req.query.email : "";
  if (!email || isNaN(jobId)) {
    res.status(400).json({ error: "email and jobId required" });
    return;
  }
  const user = req.user!;
  if (user.role !== "admin" && user.role !== "hr_officer") {
    if (user.email?.toLowerCase() !== email.toLowerCase()) {
      res.status(403).json({ error: "Forbidden: email mismatch" }); return;
    }
  }
  const [draft] = await db.select().from(applicationDraftTable)
    .where(and(eq(applicationDraftTable.candidateEmail, email), eq(applicationDraftTable.jobId, jobId)));
  res.json(draft ?? null);
});

// Delete draft (POST-submission cleanup) — requires auth
router.delete("/applications/draft/:jobId", authMiddleware, async (req, res): Promise<void> => {
  const jobId = parseInt(req.params.jobId ?? "");
  const email = typeof req.query.email === "string" ? req.query.email : "";
  if (!email || isNaN(jobId)) {
    res.status(400).json({ error: "email and jobId required" }); return;
  }
  const user = req.user!;
  if (user.role !== "admin" && user.role !== "hr_officer") {
    if (user.email?.toLowerCase() !== email.toLowerCase()) {
      res.status(403).json({ error: "Forbidden: email mismatch" }); return;
    }
  }
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
  const data = extended.success ? extended.data : basic!.data;
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

router.patch("/applications/:id", authMiddleware, async (req, res): Promise<void> => {
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

export default router;
