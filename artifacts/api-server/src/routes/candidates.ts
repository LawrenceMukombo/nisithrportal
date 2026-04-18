import { Router, type IRouter } from "express";
import { eq, inArray, and } from "drizzle-orm";
import {
  db,
  candidatesTable,
  applicationsTable,
  applicationDocumentsTable,
  jobsTable,
  candidateEducationTable,
  candidateExperienceTable,
  candidateLanguagesTable,
  candidateDiversityTable,
  candidateRefereesTable,
} from "@workspace/db";
import { applicationScreeningAnswersTable, jobScreeningQuestionsTable } from "@workspace/db";
import {
  CreateCandidateBody,
  GetCandidateParams,
  UpdateCandidateParams,
  UpdateCandidateBody,
} from "@workspace/api-zod";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";
import { getTenantAgencyId } from "../middlewares/tenant";

const router: IRouter = Router();

const candidateIdsForAgencySubquery = (agencyId: number) =>
  db
    .select({ candidateId: applicationsTable.candidateId })
    .from(applicationsTable)
    .where(
      inArray(
        applicationsTable.jobId,
        db.select({ id: jobsTable.id }).from(jobsTable).where(eq(jobsTable.agencyId, agencyId))
      )
    );

router.get("/candidates", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const agencyId = getTenantAgencyId(req);

  if (agencyId != null) {
    const candidates = await db
      .select()
      .from(candidatesTable)
      .where(inArray(candidatesTable.id, candidateIdsForAgencySubquery(agencyId)))
      .orderBy(candidatesTable.createdAt);
    res.json(candidates);
    return;
  }

  const candidates = await db.select().from(candidatesTable).orderBy(candidatesTable.createdAt);
  res.json(candidates);
});

router.post("/candidates", async (req, res): Promise<void> => {
  const parsed = CreateCandidateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [candidate] = await db.insert(candidatesTable).values({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone ?? null,
    cvUrl: parsed.data.cvUrl ?? null,
  }).returning();
  res.status(201).json(candidate);
});

router.get("/candidates/:id", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const params = GetCandidateParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid candidate id" });
    return;
  }
  const [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, params.data.id));
  if (!candidate) {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }
  const agencyId = getTenantAgencyId(req);
  if (agencyId != null) {
    const [match] = await db
      .select({ candidateId: applicationsTable.candidateId })
      .from(applicationsTable)
      .innerJoin(jobsTable, eq(applicationsTable.jobId, jobsTable.id))
      .where(and(eq(applicationsTable.candidateId, params.data.id), eq(jobsTable.agencyId, agencyId)))
      .limit(1);
    if (!match) {
      res.status(403).json({ error: "Forbidden: candidate has no applications to your agency's jobs" });
      return;
    }
  }
  res.json(candidate);
});

router.patch("/candidates/:id", authMiddleware, requireRole("admin", "hr_officer"), async (req, res): Promise<void> => {
  const params = UpdateCandidateParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid candidate id" });
    return;
  }
  const agencyId = getTenantAgencyId(req);
  if (agencyId != null) {
    const [match] = await db
      .select({ candidateId: applicationsTable.candidateId })
      .from(applicationsTable)
      .innerJoin(jobsTable, eq(applicationsTable.jobId, jobsTable.id))
      .where(and(eq(applicationsTable.candidateId, params.data.id), eq(jobsTable.agencyId, agencyId)))
      .limit(1);
    if (!match) {
      res.status(403).json({ error: "Forbidden: candidate has no applications to your agency's jobs" });
      return;
    }
  }
  const body = UpdateCandidateBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [candidate] = await db.update(candidatesTable)
    .set({
      name: body.data.name,
      email: body.data.email,
      phone: body.data.phone ?? undefined,
      cvUrl: body.data.cvUrl ?? undefined,
      parsedData: body.data.parsedData,
    })
    .where(eq(candidatesTable.id, params.data.id))
    .returning();
  if (!candidate) {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }
  res.json(candidate);
});

// GET /candidates/:id/profile — full profile for HR view (sub-records)
router.get("/candidates/:id/profile", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const params = GetCandidateParams.safeParse({ id: parseIntParam(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid candidate id" });
    return;
  }
  const candidateId = params.data.id;
  const [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, candidateId));
  if (!candidate) {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }
  const agencyId = getTenantAgencyId(req);
  if (agencyId != null) {
    const [match] = await db
      .select({ candidateId: applicationsTable.candidateId })
      .from(applicationsTable)
      .innerJoin(jobsTable, eq(applicationsTable.jobId, jobsTable.id))
      .where(and(eq(applicationsTable.candidateId, candidateId), eq(jobsTable.agencyId, agencyId)))
      .limit(1);
    if (!match) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  // Fetch all sub-records in parallel (diversity excluded — aggregate-only per privacy policy)
  const [education, experience, languages, referees, applications] = await Promise.all([
    db.select().from(candidateEducationTable).where(eq(candidateEducationTable.candidateId, candidateId)),
    db.select().from(candidateExperienceTable).where(eq(candidateExperienceTable.candidateId, candidateId)),
    db.select().from(candidateLanguagesTable).where(eq(candidateLanguagesTable.candidateId, candidateId)),
    db
      .select({
        id: candidateRefereesTable.id,
        applicationId: candidateRefereesTable.applicationId,
        name: candidateRefereesTable.name,
        relationship: candidateRefereesTable.relationship,
        organisation: candidateRefereesTable.organisation,
        email: candidateRefereesTable.email,
        phone: candidateRefereesTable.phone,
      })
      .from(candidateRefereesTable)
      .innerJoin(applicationsTable, eq(candidateRefereesTable.applicationId, applicationsTable.id))
      .where(eq(applicationsTable.candidateId, candidateId)),
    db
      .select({
        id: applicationsTable.id,
        jobId: applicationsTable.jobId,
        status: applicationsTable.status,
        createdAt: applicationsTable.createdAt,
        expectedSalary: applicationsTable.expectedSalary,
        currentSalary: applicationsTable.currentSalary,
        noticePeriod: applicationsTable.noticePeriod,
        declarationAgreed: applicationsTable.declarationAgreed,
        backgroundCheckConsent: applicationsTable.backgroundCheckConsent,
        conflictOfInterest: applicationsTable.conflictOfInterest,
        criminalRecord: applicationsTable.criminalRecord,
        dataPrivacyConsent: applicationsTable.dataPrivacyConsent,
      })
      .from(applicationsTable)
      .where(eq(applicationsTable.candidateId, candidateId)),
  ]);

  // Fetch documents and screening answers for all applications
  const appIds = applications.map((a) => a.id);
  const [documents, screeningAnswers] = appIds.length > 0 ? await Promise.all([
    db
      .select({
        id: applicationDocumentsTable.id,
        applicationId: applicationDocumentsTable.applicationId,
        documentType: applicationDocumentsTable.documentType,
        url: applicationDocumentsTable.url,
        fileName: applicationDocumentsTable.fileName,
      })
      .from(applicationDocumentsTable)
      .where(inArray(applicationDocumentsTable.applicationId, appIds)),
    db
      .select({
        id: applicationScreeningAnswersTable.id,
        applicationId: applicationScreeningAnswersTable.applicationId,
        questionId: applicationScreeningAnswersTable.questionId,
        answer: applicationScreeningAnswersTable.answer,
        question: jobScreeningQuestionsTable.question,
        questionType: jobScreeningQuestionsTable.questionType,
      })
      .from(applicationScreeningAnswersTable)
      .innerJoin(jobScreeningQuestionsTable, eq(applicationScreeningAnswersTable.questionId, jobScreeningQuestionsTable.id))
      .where(inArray(applicationScreeningAnswersTable.applicationId, appIds)),
  ]) : [[], []];

  // Group documents and answers by applicationId for easier frontend consumption
  const documentsByApp: Record<number, typeof documents> = {};
  for (const doc of documents) {
    if (!documentsByApp[doc.applicationId]) documentsByApp[doc.applicationId] = [];
    documentsByApp[doc.applicationId].push(doc);
  }
  const answersByApp: Record<number, typeof screeningAnswers> = {};
  for (const ans of screeningAnswers) {
    if (!answersByApp[ans.applicationId]) answersByApp[ans.applicationId] = [];
    answersByApp[ans.applicationId].push(ans);
  }

  const applicationsEnriched = applications.map((app) => ({
    ...app,
    documents: documentsByApp[app.id] ?? [],
    screeningAnswers: answersByApp[app.id] ?? [],
  }));

  // Diversity data is stored for aggregate analytics only — never returned per-candidate
  res.json({ ...candidate, education, experience, languages, referees, applications: applicationsEnriched });
});

export default router;
