import { Router, type IRouter } from "express";
import { eq, and, desc, or, sql } from "drizzle-orm";
import { db, offboardingWorkflowsTable, offboardingTasksTable, employeesTable, positionsTable, usersTable, rolesTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/auth";
import { writeAuditLog } from "../lib/audit";
import { createApproval } from "./workflows";

const router: IRouter = Router();

const DEFAULT_OFFBOARDING_TASKS = [
  { title: "Exit Interview & Clearance Discussion", category: "hr_documentation" },
  { title: "NISIT Laptop & Accessories Return", category: "asset_return" },
  { title: "Security Pass & Office Keys Return", category: "asset_return" },
  { title: "Active Directory, Email & Cloud Access Revocation", category: "it_revocation" },
  { title: "Final Salary, Gratuity & Leave Payout Reconciliation", category: "finance_clearance" },
  { title: "Issuance of Certificate of Service & Final Letter", category: "hr_documentation" },
];
const SEPARATION_STATUS: Record<string, string> = {
  resignation: "resigned",
  retirement: "retired",
  termination: "terminated",
  contract_end: "terminated",
  contract_expiry: "terminated",
  redundancy: "terminated",
  death: "deceased",
  other: "terminated",
};
async function canUpdateTask(userId: number, assignedToUserId: number | null): Promise<boolean> {
  if (assignedToUserId === userId) return true;
  const [user] = await db.select({ role: rolesTable.name }).from(usersTable).leftJoin(rolesTable, eq(usersTable.roleId, rolesTable.id)).where(eq(usersTable.id, userId));
  return ["admin", "hr_manager", "hr_officer"].includes(user?.role ?? "");
}

// GET /api/offboarding - List offboarding workflows
router.get("/offboarding", authMiddleware, async (_req, res): Promise<void> => {
  try {
    const workflows = await db
      .select({
        id: offboardingWorkflowsTable.id,
        employeeId: offboardingWorkflowsTable.employeeId,
        employeeName: employeesTable.name,
        employeeEmail: employeesTable.email,
        employeePosition: positionsTable.title,
        reason: offboardingWorkflowsTable.reason,
        separationDate: offboardingWorkflowsTable.separationDate,
        status: offboardingWorkflowsTable.status,
        exitInterviewDone: offboardingWorkflowsTable.exitInterviewDone,
        exitInterviewNotes: offboardingWorkflowsTable.exitInterviewNotes,
        handoverCompleted: offboardingWorkflowsTable.handoverCompleted,
        createdAt: offboardingWorkflowsTable.createdAt,
      })
      .from(offboardingWorkflowsTable)
      .leftJoin(employeesTable, eq(offboardingWorkflowsTable.employeeId, employeesTable.id))
      .leftJoin(positionsTable, eq(employeesTable.positionId, positionsTable.id))
      .orderBy(desc(offboardingWorkflowsTable.createdAt));

    const workflowsWithTasks = await Promise.all(
      workflows.map(async (wf) => {
        const tasks = await db
          .select()
          .from(offboardingTasksTable)
          .where(eq(offboardingTasksTable.workflowId, wf.id));
        return { ...wf, tasks };
      })
    );

    res.json(workflowsWithTasks);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch offboarding workflows" });
  }
});

// POST /api/offboarding - Initiate offboarding
router.post("/offboarding", authMiddleware, requireRole("admin", "hr_manager", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const { employeeId, reason, separationDate, exitInterviewNotes } = req.body;

    if (!employeeId || !reason || !separationDate) {
      res.status(400).json({ error: "Employee ID, reason, and separation date are required" });
      return;
    }
    if (!SEPARATION_STATUS[reason]) { res.status(400).json({ error: "Invalid separation reason" }); return; }

    const [workflow] = await db
      .insert(offboardingWorkflowsTable)
      .values({
        employeeId: parseInt(employeeId),
        reason,
        separationDate,
        exitInterviewNotes: exitInterviewNotes || null,
        status: "in_progress",
      })
      .returning();
    const [employee] = await db.select({ agencyId: employeesTable.agencyId }).from(employeesTable).where(eq(employeesTable.id, workflow.employeeId));
    await createApproval("offboarding", workflow.id, req.user?.userId ?? null, employee?.agencyId ?? null);

    // Insert default offboarding tasks
    const tasksToInsert = DEFAULT_OFFBOARDING_TASKS.map((t) => ({
      workflowId: workflow.id,
      title: t.title,
      category: t.category,
      status: "pending",
    }));

    await db.insert(offboardingTasksTable).values(tasksToInsert);

    const tasks = await db.select().from(offboardingTasksTable).where(eq(offboardingTasksTable.workflowId, workflow.id));
    res.status(201).json({ ...workflow, tasks });
  } catch (error) {
    res.status(500).json({ error: "Failed to initiate offboarding workflow" });
  }
});

// PATCH /api/offboarding/tasks/:taskId - Update offboarding task
router.patch("/offboarding/tasks/:taskId", authMiddleware, async (req, res): Promise<void> => {
  try {
    const taskId = parseInt(req.params.taskId as string);
    const { status, notes } = req.body;
    const [existing] = await db.select({ assignedToUserId: offboardingTasksTable.assignedToUserId }).from(offboardingTasksTable).where(eq(offboardingTasksTable.id, taskId));
    if (!existing) { res.status(404).json({ error: "Task not found" }); return; }
    if (!await canUpdateTask(req.user!.userId, existing.assignedToUserId)) { res.status(403).json({ error: "Forbidden: task is not assigned to you" }); return; }

    const [updated] = await db
      .update(offboardingTasksTable)
      .set({
        status: status || undefined,
        notes: notes !== undefined ? notes : undefined,
        completedAt: status === "completed" ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(offboardingTasksTable.id, taskId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    // Check if all tasks are done
    const remaining = await db
      .select()
      .from(offboardingTasksTable)
      .where(and(eq(offboardingTasksTable.workflowId, updated.workflowId), eq(offboardingTasksTable.status, "pending")));

    if (remaining.length === 0) {
      const [wf] = await db
        .update(offboardingWorkflowsTable)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(offboardingWorkflowsTable.id, updated.workflowId))
        .returning();

      // Mark employee status as terminated / separated
      if (wf?.employeeId) {
        const [emp] = await db
          .update(employeesTable)
          .set({ status: SEPARATION_STATUS[wf.reason] ?? "terminated", separationDate: wf.separationDate, separationReason: wf.reason, updatedAt: new Date() })
          .where(eq(employeesTable.id, wf.employeeId))
          .returning();

        // Automatically deactivate user account linked by employeeId or email
        if (emp?.email) {
          const [deactivatedUser] = await db
            .update(usersTable)
            .set({ status: "inactive", tokenVersion: sql`${usersTable.tokenVersion} + 1`, updatedAt: new Date() })
            .where(or(eq(usersTable.employeeId, emp.id), eq(usersTable.email, emp.email)))
            .returning({ id: usersTable.id, email: usersTable.email });

          if (deactivatedUser) {
            await writeAuditLog({
              performedById: (req as any).user?.userId ?? null,
              performedByEmail: (req as any).user?.email ?? null,
              targetUserId: deactivatedUser.id,
              targetEmail: deactivatedUser.email,
              actionType: "status_change",
              outcome: "success",
              details: { reason: "automatic_deactivation_on_offboarding_completion", employeeId: emp.id },
            });
          }
        }
      }
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update offboarding task" });
  }
});

export default router;
