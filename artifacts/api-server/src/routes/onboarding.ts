import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, onboardingWorkflowsTable, onboardingTasksTable, onboardingTemplatesTable, onboardingTemplateTasksTable, employeesTable, usersTable, candidatesTable, positionsTable, rolesTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/auth";
import { createApproval } from "./workflows";
import { getTenantAgencyId } from "../middlewares/tenant";

const router: IRouter = Router();

const DEFAULT_ONBOARDING_TASKS = [
  { title: "Employee Master Profile Verification", category: "hr", assignedRole: "hr_officer", description: "Verify identity documents, bank details, and emergency contacts" },
  { title: "Employment Contract & Code of Conduct Signing", category: "hr", assignedRole: "hr_officer", description: "Issue official NISIT appointment letter and signed contract" },
  { title: "NISIT Active Directory & Email Account Provisioning", category: "it", assignedRole: "it_admin", description: "Create @nisit.gov.pg email and Microsoft 365 access" },
  { title: "Workstation, Laptop & Access Card Issuance", category: "it", assignedRole: "it_admin", description: "Configure secure hardware and building security pass" },
  { title: "Departmental Orientation & Workstation Setup", category: "manager", assignedRole: "hiring_manager", description: "Introduce to team and assign 90-day probation objectives" },
  { title: "Nasfund Superannuation & Health Insurance Enrolment", category: "hr", assignedRole: "hr_officer", description: "Submit benefits paperwork to provider" },
  { title: "Mandatory Public Service Ethics & Safety Induction", category: "employee", assignedRole: "employee", description: "Complete online compliance induction module" },
];
async function canUpdateTask(userId: number, task: { assignedToUserId: number | null; assignedRole: string }): Promise<boolean> {
  if (task.assignedToUserId === userId) return true;
  const [user] = await db.select({ role: rolesTable.name }).from(usersTable).leftJoin(rolesTable, eq(usersTable.roleId, rolesTable.id)).where(eq(usersTable.id, userId));
  return ["admin", "hr_manager", "hr_officer"].includes(user?.role ?? "") || user?.role === task.assignedRole;
}

router.get("/onboarding/templates", authMiddleware, requireRole("admin", "hr_manager", "hr_officer"), async (_req, res): Promise<void> => {
  const templates = await db.select().from(onboardingTemplatesTable).orderBy(onboardingTemplatesTable.name, onboardingTemplatesTable.version);
  const result = await Promise.all(templates.map(async (template) => ({ ...template, tasks: await db.select().from(onboardingTemplateTasksTable).where(eq(onboardingTemplateTasksTable.templateId, template.id)).orderBy(onboardingTemplateTasksTable.orderIndex) })));
  res.json(result);
});

router.post("/onboarding/templates", authMiddleware, requireRole("admin", "hr_manager"), async (req, res): Promise<void> => {
  const { name, departmentId, employmentType, location, tasks } = req.body ?? {};
  if (!name || !Array.isArray(tasks) || tasks.length === 0) { res.status(400).json({ error: "name and at least one task are required" }); return; }
  const [template] = await db.insert(onboardingTemplatesTable).values({ name, departmentId: departmentId ?? null, employmentType: employmentType ?? null, location: location ?? null }).returning();
  await db.insert(onboardingTemplateTasksTable).values(tasks.map((task: Record<string, unknown>, index: number) => ({ templateId: template.id, title: String(task.title ?? ""), description: typeof task.description === "string" ? task.description : null, category: typeof task.category === "string" ? task.category : "general", assignedRole: typeof task.assignedRole === "string" ? task.assignedRole : "hr_officer", mandatory: task.mandatory !== false, dueDays: Number.isInteger(task.dueDays) ? task.dueDays as number : null, orderIndex: index })));
  res.status(201).json(template);
});

// GET /api/onboarding - List onboarding workflows
router.get("/onboarding", authMiddleware, requireRole("admin", "hr_manager", "hr_officer", "hiring_manager", "executive"), async (req, res): Promise<void> => {
  try {
    const workflows = await db
      .select({
        id: onboardingWorkflowsTable.id,
        employeeId: onboardingWorkflowsTable.employeeId,
        employeeName: employeesTable.name,
        employeeEmail: employeesTable.email,
        employeePosition: positionsTable.title,
        status: onboardingWorkflowsTable.status,
        startDate: onboardingWorkflowsTable.startDate,
        targetCompletionDate: onboardingWorkflowsTable.targetCompletionDate,
        notes: onboardingWorkflowsTable.notes,
        createdAt: onboardingWorkflowsTable.createdAt,
      })
      .from(onboardingWorkflowsTable)
      .leftJoin(employeesTable, eq(onboardingWorkflowsTable.employeeId, employeesTable.id))
      .leftJoin(positionsTable, eq(employeesTable.positionId, positionsTable.id))
      .where(getTenantAgencyId(req) == null ? undefined : eq(employeesTable.agencyId, getTenantAgencyId(req)!))
      .orderBy(desc(onboardingWorkflowsTable.createdAt));

    // Fetch tasks for each workflow
    const workflowsWithTasks = await Promise.all(
      workflows.map(async (wf) => {
        const tasks = await db
          .select()
          .from(onboardingTasksTable)
          .where(eq(onboardingTasksTable.workflowId, wf.id))
          .orderBy(onboardingTasksTable.orderIndex);
        return { ...wf, tasks };
      })
    );

    res.json(workflowsWithTasks);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch onboarding workflows" });
  }
});

// POST /api/onboarding - Initiate onboarding workflow
router.post("/onboarding", authMiddleware, requireRole("admin", "hr_manager", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const { employeeId, candidateId, startDate, targetCompletionDate, notes, templateId } = req.body;

    if (!employeeId || !startDate) {
      res.status(400).json({ error: "Employee ID and start date are required" });
      return;
    }

    const [employeeRecord] = await db.select().from(employeesTable).where(eq(employeesTable.id, parseInt(employeeId)));
    if (!employeeRecord) { res.status(404).json({ error: "Employee not found" }); return; }
    const templates = await db.select().from(onboardingTemplatesTable).where(eq(onboardingTemplatesTable.active, true));
    const selectedTemplate = templateId ? templates.find((template) => template.id === parseInt(templateId)) : templates.find((template) =>
      (template.departmentId == null || template.departmentId === employeeRecord.departmentId) &&
      (template.employmentType == null || template.employmentType === employeeRecord.employmentType) &&
      (template.location == null || template.location === employeeRecord.city)
    );
    const [workflow] = await db
      .insert(onboardingWorkflowsTable)
      .values({
        employeeId: parseInt(employeeId),
        candidateId: candidateId ? parseInt(candidateId) : null,
        templateId: selectedTemplate?.id ?? null,
        startDate,
        targetCompletionDate: targetCompletionDate || null,
        notes: notes || null,
        status: "in_progress",
      })
      .returning();
    const [employee] = await db.select({ agencyId: employeesTable.agencyId }).from(employeesTable).where(eq(employeesTable.id, workflow.employeeId));
    await createApproval("onboarding", workflow.id, req.user?.userId ?? null, employee?.agencyId ?? null);

    // Insert default checklist tasks
    const templateTasks = selectedTemplate ? await db.select().from(onboardingTemplateTasksTable).where(eq(onboardingTemplateTasksTable.templateId, selectedTemplate.id)).orderBy(onboardingTemplateTasksTable.orderIndex) : [];
    const sourceTasks = templateTasks.length ? templateTasks : DEFAULT_ONBOARDING_TASKS;
    const tasksToInsert = sourceTasks.map((t, idx) => ({
      workflowId: workflow.id,
      title: t.title,
      description: t.description,
      category: t.category,
      assignedRole: t.assignedRole,
      mandatory: "mandatory" in t ? t.mandatory : true,
      status: "pending",
      orderIndex: idx,
    }));

    await db.insert(onboardingTasksTable).values(tasksToInsert);

    const tasks = await db.select().from(onboardingTasksTable).where(eq(onboardingTasksTable.workflowId, workflow.id));
    res.status(201).json({ ...workflow, tasks });
  } catch (error) {
    res.status(500).json({ error: "Failed to initiate onboarding workflow" });
  }
});

// PATCH /api/onboarding/tasks/:taskId - Update task status
router.patch("/onboarding/tasks/:taskId", authMiddleware, async (req, res): Promise<void> => {
  try {
    const taskId = parseInt(req.params.taskId as string);
    const { status, notes, assignedToUserId } = req.body;
    const [existing] = await db.select({ assignedToUserId: onboardingTasksTable.assignedToUserId, assignedRole: onboardingTasksTable.assignedRole }).from(onboardingTasksTable).where(eq(onboardingTasksTable.id, taskId));
    if (!existing) { res.status(404).json({ error: "Task not found" }); return; }
    if (!await canUpdateTask(req.user!.userId, existing)) { res.status(403).json({ error: "Forbidden: task is not assigned to you" }); return; }

    const [updated] = await db
      .update(onboardingTasksTable)
      .set({
        status: status || undefined,
        notes: notes !== undefined ? notes : undefined,
        assignedToUserId: assignedToUserId !== undefined ? assignedToUserId : undefined,
        completedAt: status === "completed" ? new Date() : undefined,
        completedByUserId: status === "completed" ? req.user?.userId : undefined,
        updatedAt: new Date(),
      })
      .where(eq(onboardingTasksTable.id, taskId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    // Check if all tasks in the workflow are completed
    const remaining = await db
      .select()
      .from(onboardingTasksTable)
      .where(and(eq(onboardingTasksTable.workflowId, updated.workflowId), eq(onboardingTasksTable.status, "pending")));

    if (remaining.length === 0) {
      await db
        .update(onboardingWorkflowsTable)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(onboardingWorkflowsTable.id, updated.workflowId));
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update onboarding task" });
  }
});

export default router;
