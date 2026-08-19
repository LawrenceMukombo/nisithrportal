import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, performanceCyclesTable, performanceReviewsTable, goalsTable, employeesTable, positionsTable, usersTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/auth";
import { createApproval } from "./workflows";

const router: IRouter = Router();

// GET /api/performance/cycles - List review cycles
router.get("/performance/cycles", authMiddleware, async (_req, res): Promise<void> => {
  try {
    const cycles = await db.select().from(performanceCyclesTable).orderBy(desc(performanceCyclesTable.startDate));
    res.json(cycles);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch performance cycles" });
  }
});

// POST /api/performance/cycles - Create review cycle
router.post("/performance/cycles", authMiddleware, requireRole("admin", "hr_manager", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const { title, type, startDate, endDate, description } = req.body;
    if (!title || !startDate || !endDate) {
      res.status(400).json({ error: "Title, start date, and end date are required" });
      return;
    }

    const [cycle] = await db
      .insert(performanceCyclesTable)
      .values({
        title,
        type: type || "annual",
        startDate,
        endDate,
        description,
        status: "active",
      })
      .returning();

    res.status(201).json(cycle);
  } catch (error) {
    res.status(500).json({ error: "Failed to create performance cycle" });
  }
});

// GET /api/performance/reviews - List reviews
router.get("/performance/reviews", authMiddleware, async (req, res): Promise<void> => {
  try {
    const cycleIdParam = req.query.cycle_id ? parseInt(req.query.cycle_id as string) : undefined;
    const employeeIdParam = req.query.employee_id ? parseInt(req.query.employee_id as string) : undefined;

    const conditions = [];
    if (cycleIdParam) conditions.push(eq(performanceReviewsTable.cycleId, cycleIdParam));
    if (employeeIdParam) conditions.push(eq(performanceReviewsTable.employeeId, employeeIdParam));

    const reviews = await db
      .select({
        id: performanceReviewsTable.id,
        cycleId: performanceReviewsTable.cycleId,
        cycleTitle: performanceCyclesTable.title,
        employeeId: performanceReviewsTable.employeeId,
        employeeName: employeesTable.name,
        employeeTitle: positionsTable.title,
        reviewerId: performanceReviewsTable.reviewerId,
        status: performanceReviewsTable.status,
        selfScore: performanceReviewsTable.selfScore,
        managerScore: performanceReviewsTable.managerScore,
        finalRating: performanceReviewsTable.finalRating,
        selfFeedback: performanceReviewsTable.selfFeedback,
        managerFeedback: performanceReviewsTable.managerFeedback,
        strengths: performanceReviewsTable.strengths,
        developmentAreas: performanceReviewsTable.developmentAreas,
        goalsSummary: performanceReviewsTable.goalsSummary,
        completedAt: performanceReviewsTable.completedAt,
        createdAt: performanceReviewsTable.createdAt,
      })
      .from(performanceReviewsTable)
      .leftJoin(performanceCyclesTable, eq(performanceReviewsTable.cycleId, performanceCyclesTable.id))
      .leftJoin(employeesTable, eq(performanceReviewsTable.employeeId, employeesTable.id))
      .leftJoin(positionsTable, eq(employeesTable.positionId, positionsTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(performanceReviewsTable.createdAt));

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch performance reviews" });
  }
});

// POST /api/performance/reviews - Initiate review
router.post("/performance/reviews", authMiddleware, requireRole("admin", "hr_manager", "hr_officer", "hiring_manager"), async (req, res): Promise<void> => {
  try {
    const { cycleId, employeeId, reviewerId } = req.body;
    if (!cycleId || !employeeId) {
      res.status(400).json({ error: "Cycle ID and Employee ID are required" });
      return;
    }

    const [review] = await db
      .insert(performanceReviewsTable)
      .values({
        cycleId: parseInt(cycleId),
        employeeId: parseInt(employeeId),
        reviewerId: reviewerId ? parseInt(reviewerId) : null,
        status: "self_review",
      })
      .returning();
    const [employee] = await db.select({ agencyId: employeesTable.agencyId }).from(employeesTable).where(eq(employeesTable.id, review.employeeId));
    await createApproval("performance_review", review.id, req.user?.userId ?? null, employee?.agencyId ?? null);

    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ error: "Failed to initiate review" });
  }
});

// PATCH /api/performance/reviews/:id - Update review scores / feedback
router.patch("/performance/reviews/:id", authMiddleware, async (req, res): Promise<void> => {
  try {
    const reviewId = parseInt(String(req.params.id), 10);
    const { status, selfScore, managerScore, finalRating, selfFeedback, managerFeedback, strengths, developmentAreas, goalsSummary } = req.body;

    const [updated] = await db
      .update(performanceReviewsTable)
      .set({
        status: status || undefined,
        selfScore: selfScore !== undefined ? String(selfScore) : undefined,
        managerScore: managerScore !== undefined ? String(managerScore) : undefined,
        finalRating: finalRating || undefined,
        selfFeedback: selfFeedback !== undefined ? selfFeedback : undefined,
        managerFeedback: managerFeedback !== undefined ? managerFeedback : undefined,
        strengths: strengths !== undefined ? strengths : undefined,
        developmentAreas: developmentAreas !== undefined ? developmentAreas : undefined,
        goalsSummary: goalsSummary !== undefined ? goalsSummary : undefined,
        completedAt: status === "completed" ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(performanceReviewsTable.id, reviewId))
      .returning();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update review" });
  }
});

// GET /api/performance/goals - List employee goals / OKRs
router.get("/performance/goals", authMiddleware, async (req, res): Promise<void> => {
  try {
    const employeeIdParam = req.query.employee_id ? parseInt(req.query.employee_id as string) : undefined;
    const cycleIdParam = req.query.cycle_id ? parseInt(req.query.cycle_id as string) : undefined;

    const conditions = [];
    if (employeeIdParam) conditions.push(eq(goalsTable.employeeId, employeeIdParam));
    if (cycleIdParam) conditions.push(eq(goalsTable.cycleId, cycleIdParam));

    const goals = await db
      .select({
        id: goalsTable.id,
        employeeId: goalsTable.employeeId,
        employeeName: employeesTable.name,
        cycleId: goalsTable.cycleId,
        title: goalsTable.title,
        description: goalsTable.description,
        category: goalsTable.category,
        targetDate: goalsTable.targetDate,
        dueDate: goalsTable.targetDate,
        weightage: goalsTable.weightage,
        weight: goalsTable.weightage,
        progressPercentage: goalsTable.progressPercentage,
        progressPercent: goalsTable.progressPercentage,
        status: goalsTable.status,
        metrics: goalsTable.metrics,
        createdAt: goalsTable.createdAt,
      })
      .from(goalsTable)
      .leftJoin(employeesTable, eq(goalsTable.employeeId, employeesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(goalsTable.createdAt));

    res.json(goals);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch goals" });
  }
});

// POST /api/performance/goals - Create new goal / OKR
router.post("/performance/goals", authMiddleware, async (req, res): Promise<void> => {
  try {
    const { employeeId, cycleId, title, description, category, targetDate, weightage, metrics, targetValue, currentValue, unit, dueDate } = req.body;

    const targetEmployeeId = employeeId ? parseInt(employeeId) : (req as any).user?.userId || 1;

    if (!title) {
      res.status(400).json({ error: "Goal title is required" });
      return;
    }

    let targetCycleId = cycleId ? parseInt(cycleId) : null;
    if (!targetCycleId) {
      const [activeCycle] = await db
        .select({ id: performanceCyclesTable.id })
        .from(performanceCyclesTable)
        .where(eq(performanceCyclesTable.status, "active"))
        .limit(1);
      if (activeCycle) targetCycleId = activeCycle.id;
    }

    const [goal] = await db
      .insert(goalsTable)
      .values({
        employeeId: targetEmployeeId,
        cycleId: targetCycleId,
        title,
        description: description || null,
        category: category || "operational",
        targetDate: targetDate || dueDate || null,
        weightage: weightage ? parseInt(weightage) : 20,
        progressPercentage: currentValue && targetValue ? Math.min(100, Math.round((parseFloat(currentValue) / parseFloat(targetValue)) * 100)) : 0,
        status: "in_progress",
        metrics: metrics || (targetValue && unit ? `Target: ${targetValue} ${unit}, Current: ${currentValue || 0} ${unit}` : null),
      })
      .returning();

    res.status(201).json(goal);
  } catch (error) {
    res.status(500).json({ error: "Failed to create goal" });
  }
});

// PATCH /api/performance/goals/:id - Update goal progress
router.patch("/performance/goals/:id", authMiddleware, async (req, res): Promise<void> => {
  try {
    const goalId = parseInt(String(req.params.id), 10);
    const { progressPercentage, status, description, metrics } = req.body;

    const [updated] = await db
      .update(goalsTable)
      .set({
        progressPercentage: progressPercentage !== undefined ? parseInt(progressPercentage) : undefined,
        status: status || (progressPercentage === 100 ? "achieved" : undefined),
        description: description !== undefined ? description : undefined,
        metrics: metrics !== undefined ? metrics : undefined,
        updatedAt: new Date(),
      })
      .where(eq(goalsTable.id, goalId))
      .returning();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update goal" });
  }
});

export default router;
