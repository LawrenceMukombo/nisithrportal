import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, approvalActionsTable, approvalInstancesTable, workflowDefinitionsTable, leaveRequestsTable, housingApplicationsTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/auth";
import { notifyAdmins } from "../lib/notificationService";

const router: IRouter = Router();
const DEFAULT_STEPS = [{ role: "hiring_manager", label: "Manager approval" }, { role: "hr_officer", label: "HR review" }];

export async function escalateOverdueApprovals(): Promise<void> {
  const overdue = await db.select().from(approvalInstancesTable)
    .where(and(eq(approvalInstancesTable.status, "pending"), sql`${approvalInstancesTable.dueAt} < now()`, sql`${approvalInstancesTable.escalatedAt} IS NULL`));
  for (const item of overdue) {
    await db.update(approvalInstancesTable).set({ escalatedAt: new Date() }).where(eq(approvalInstancesTable.id, item.id));
    await notifyAdmins(item.agencyId, "approval_escalated", `Approval #${item.id} for ${item.entityType} #${item.entityId} is overdue.`);
  }
}

export async function createApproval(entityType: string, entityId: number, requesterId: number | null, agencyId: number | null) {
  const [definition] = await db.select().from(workflowDefinitionsTable)
    .where(and(eq(workflowDefinitionsTable.entityType, entityType), eq(workflowDefinitionsTable.active, true))).orderBy(desc(workflowDefinitionsTable.id)).limit(1);
  const dueAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  return (await db.insert(approvalInstancesTable).values({ definitionId: definition?.id ?? null, agencyId, entityType, entityId, requesterId, status: "pending", dueAt }).returning())[0];
}

router.get("/workflow-definitions", authMiddleware, requireRole("admin", "hr_officer"), async (_req, res) => {
  res.json(await db.select().from(workflowDefinitionsTable).orderBy(workflowDefinitionsTable.entityType, workflowDefinitionsTable.name));
});
router.post("/workflow-definitions", authMiddleware, requireRole("admin"), async (req, res) => {
  const { entityType, name, steps } = req.body ?? {};
  if (!entityType || !name || !Array.isArray(steps) || !steps.length) { res.status(400).json({ error: "entityType, name and one or more steps are required" }); return; }
  const [definition] = await db.insert(workflowDefinitionsTable).values({ entityType, name, steps, agencyId: req.user!.agencyId }).returning();
  res.status(201).json(definition);
});
router.get("/approvals", authMiddleware, async (req, res) => {
  const entityType = typeof req.query.entity_type === "string" ? req.query.entity_type : undefined;
  const rows = await db.select().from(approvalInstancesTable).where(entityType ? eq(approvalInstancesTable.entityType, entityType) : undefined).orderBy(desc(approvalInstancesTable.createdAt));
  res.json(rows);
});
router.post("/approvals/:id/actions", authMiddleware, requireRole("admin", "hr_officer", "hiring_manager", "executive"), async (req, res) => {
  const id = Number(req.params.id); const { action, comment, delegateToUserId } = req.body ?? {};
  if (!Number.isInteger(id) || !["approve", "reject", "delegate"].includes(action)) { res.status(400).json({ error: "Valid action is approve, reject, or delegate" }); return; }
  const [instance] = await db.select().from(approvalInstancesTable).where(eq(approvalInstancesTable.id, id));
  if (!instance || instance.status !== "pending") { res.status(404).json({ error: "Pending approval not found" }); return; }
  if (action === "delegate" && (!Number.isInteger(delegateToUserId) || delegateToUserId <= 0)) { res.status(400).json({ error: "delegateToUserId is required for delegation" }); return; }
  await db.insert(approvalActionsTable).values({ instanceId: id, step: instance.currentStep, action, actorId: req.user!.userId, comment: comment ?? null });
  if (action === "delegate") {
    const [delegated] = await db.update(approvalInstancesTable).set({ delegatedToUserId: delegateToUserId, assignedToUserId: delegateToUserId, dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) }).where(eq(approvalInstancesTable.id, id)).returning();
    res.json(delegated); return;
  }
  const definition = instance.definitionId ? (await db.select().from(workflowDefinitionsTable).where(eq(workflowDefinitionsTable.id, instance.definitionId)))[0] : null;
  const steps = Array.isArray(definition?.steps) && definition.steps.length ? definition.steps : DEFAULT_STEPS;
  const finished = action === "reject" || instance.currentStep >= steps.length;
  const [updated] = await db.update(approvalInstancesTable).set({ status: action === "reject" ? "rejected" : finished ? "approved" : "pending", currentStep: finished ? instance.currentStep : instance.currentStep + 1, completedAt: finished ? new Date() : null }).where(eq(approvalInstancesTable.id, id)).returning();
  if (finished && instance.entityType === "leave_request") {
    await db.update(leaveRequestsTable).set({ status: action === "reject" ? "rejected" : "approved", approverId: req.user!.userId, approverComment: comment ?? null, approvedAt: action === "approve" ? new Date() : null, updatedAt: new Date() }).where(eq(leaveRequestsTable.id, instance.entityId));
  }
  if (finished && instance.entityType === "housing_application") {
    await db.update(housingApplicationsTable).set({ status: action === "reject" ? "rejected" : "approved", reviewedByUserId: req.user!.userId, reviewComments: comment ?? null, approvedAt: action === "approve" ? new Date() : null, updatedAt: new Date() }).where(eq(housingApplicationsTable.id, instance.entityId));
  }
  res.json(updated);
});
export default router;
