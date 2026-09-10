import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  let dbHealthy = true;
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    dbHealthy = false;
  }
  const data = HealthCheckResponse.parse({ status: dbHealthy ? "ok" : "database_disconnected" });
  res.status(dbHealthy ? 200 : 503).json(data);
});

export default router;
