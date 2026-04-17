import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, candidatesTable, applicationsTable, jobsTable } from "@workspace/db";
import {
  CreateCandidateBody,
  GetCandidateParams,
  UpdateCandidateParams,
  UpdateCandidateBody,
} from "@workspace/api-zod";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";
import { getTenantAgencyId } from "../middlewares/tenant";

const router: IRouter = Router();

async function getAgencyJobIds(agencyId: number): Promise<Set<number>> {
  const jobs = await db.select({ id: jobsTable.id }).from(jobsTable)
    .where(eq(jobsTable.agencyId, agencyId));
  return new Set(jobs.map((j) => j.id));
}

async function getCandidateIdsForAgency(agencyId: number): Promise<Set<number>> {
  const jobIds = await getAgencyJobIds(agencyId);
  if (jobIds.size === 0) return new Set();

  const apps = await db.select({ candidateId: applicationsTable.candidateId, jobId: applicationsTable.jobId })
    .from(applicationsTable);

  const result = new Set<number>();
  for (const app of apps) {
    if (jobIds.has(app.jobId)) result.add(app.candidateId);
  }
  return result;
}

async function candidateBelongsToAgency(candidateId: number, agencyId: number): Promise<boolean> {
  const ids = await getCandidateIdsForAgency(agencyId);
  return ids.has(candidateId);
}

router.get("/candidates", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  const agencyId = getTenantAgencyId(req);

  if (agencyId != null) {
    const candidateIds = await getCandidateIdsForAgency(agencyId);
    if (candidateIds.size === 0) {
      res.json([]);
      return;
    }
    const allCandidates = await db.select().from(candidatesTable).orderBy(candidatesTable.createdAt);
    res.json(allCandidates.filter((c) => candidateIds.has(c.id)));
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
    const allowed = await candidateBelongsToAgency(params.data.id, agencyId);
    if (!allowed) {
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
    const allowed = await candidateBelongsToAgency(params.data.id, agencyId);
    if (!allowed) {
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

export default router;
