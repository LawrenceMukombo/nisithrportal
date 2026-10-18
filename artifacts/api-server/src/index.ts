import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { seedInitialData, backfillMissingJobFields, backfillCandidateUserIds, ensureChatTablesExist, ensureContractColumnsExist, ensureLeaveTablesAndColumnsExist, ensureUserSecurityColumnsExist, ensureAdminUserExists, ensureClockingTablesExist, ensureGeofenceAndSmartAttendanceTablesExist, ensurePayrollTablesExist, ensureTemporalLedgerTablesExist, alignOrganizationalPositionsAndHierarchy, ensureEmployeeNumbersExist } from "./lib/seed";
import { triggerContractExpiryNotifications } from "./routes/contracts";
import { cleanupExpiredResetTokens } from "./routes/auth";
import { triggerSavedJobClosingNotifications } from "./routes/saved-jobs";
import { verifySMTPConnection } from "./lib/email";
import { escalateOverdueApprovals } from "./routes/workflows";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const CONTRACT_EXPIRY_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
const RESET_TOKEN_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // every 24 hours
const SAVED_JOB_CLOSING_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
const APPROVAL_ESCALATION_INTERVAL_MS = 60 * 60 * 1000; // every hour

async function runSelfHealingMigrations(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
  } catch (err: any) {
    logger.warn({ err: err?.message || err }, "Database not ready yet for startup self-healing routines; will retry");
    return false;
  }

  try {
    if (process.env["SEED_ON_STARTUP"] !== "false") {
      await seedInitialData().catch((e) => logger.error(e, "Seed error"));
    }

    // Ensure WhatsApp-style messaging tables exist
    await ensureChatTablesExist().catch((e) => logger.error(e, "ensureChatTablesExist failed"));

    // Ensure contract contents columns exist
    await ensureContractColumnsExist().catch((e) => logger.error(e, "ensureContractColumnsExist failed"));

    // Ensure expanded leave tables and columns exist
    await ensureLeaveTablesAndColumnsExist().catch((e) => logger.error(e, "ensureLeaveTablesAndColumnsExist failed"));

    // Ensure user security and lockout columns exist
    await ensureUserSecurityColumnsExist().catch((e) => logger.error(e, "ensureUserSecurityColumnsExist failed"));

    // Guarantee that default administrator and core service accounts exist, are active, and have known credentials
    await ensureAdminUserExists().catch((e) => logger.error(e, "ensureAdminUserExists failed"));

    // Ensure biometric and clocking hardware interoperability tables exist
    await ensureClockingTablesExist().catch((e) => logger.error(e, "ensureClockingTablesExist failed"));

    // Ensure geofence zones and mobile/kiosk attendance columns exist
    await ensureGeofenceAndSmartAttendanceTablesExist().catch((e) => logger.error(e, "ensureGeofenceAndSmartAttendanceTablesExist failed"));

    // Ensure enterprise payroll and remuneration tables exist
    await ensurePayrollTablesExist().catch((e) => logger.error(e, "ensurePayrollTablesExist failed"));

    // Ensure temporal transaction snapshots and multi-epoch history ledger exist
    await ensureTemporalLedgerTablesExist().catch((e) => logger.error(e, "ensureTemporalLedgerTablesExist failed"));

    // Align statutory establishment positions, reporting lines, and organizational hierarchy
    await alignOrganizationalPositionsAndHierarchy().catch((e) => logger.error(e, "alignOrganizationalPositionsAndHierarchy failed"));

    // Always run legacy job backfill (idempotent)
    await backfillMissingJobFields().catch((e) => logger.error(e, "backfillMissingJobFields failed"));

    // Link legacy candidate records to user accounts
    await backfillCandidateUserIds().catch((e) => logger.error(e, "backfillCandidateUserIds failed"));

    // Ensure all employees have a statutory employee number
    await ensureEmployeeNumbersExist().catch((e) => logger.error(e, "ensureEmployeeNumbersExist failed"));

    logger.info("Startup self-healing database routines and administrator verification completed successfully");
    return true;
  } catch (err) {
    logger.error(err, "Self-healing database routine encountered an unexpected error");
    return false;
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Verify SMTP connectivity on startup and warn about missing configuration.
  const appBaseUrlSet = !!process.env["APP_BASE_URL"];
  if (!appBaseUrlSet) {
    logger.warn("APP_BASE_URL is unset — password-reset links cannot be constructed. Set APP_BASE_URL to the production frontend origin.");
  }
  verifySMTPConnection().catch((e) =>
    logger.error(e, "Startup SMTP verification failed"),
  );

  // Run self-healing routines immediately, and retry if database was temporarily offline during boot
  let migrationsDone = false;
  const executeMigrations = async () => {
    if (migrationsDone) return;
    migrationsDone = await runSelfHealingMigrations();
    if (migrationsDone && migrationRetryTimer) {
      clearInterval(migrationRetryTimer);
    }
  };

  executeMigrations().catch((e) => logger.error(e, "Initial migration execution failed"));

  const migrationRetryTimer = setInterval(() => {
    if (!migrationsDone) {
      executeMigrations().catch((e) => logger.error(e, "Retry migration execution failed"));
    }
  }, 10000);

  // Run an initial contract expiry check on startup, then every 6 hours.
  triggerContractExpiryNotifications().catch((e) =>
    logger.error(e, "Initial contract expiry check failed"),
  );
  setInterval(() => {
    triggerContractExpiryNotifications().catch((e) =>
      logger.error(e, "Scheduled contract expiry check failed"),
    );
  }, CONTRACT_EXPIRY_INTERVAL_MS);

  // Purge stale password-reset tokens on startup, then every 24 hours.
  cleanupExpiredResetTokens().catch((e) =>
    logger.error(e, "Initial reset-token cleanup failed"),
  );
  setInterval(() => {
    cleanupExpiredResetTokens().catch((e) =>
      logger.error(e, "Scheduled reset-token cleanup failed"),
    );
  }, RESET_TOKEN_CLEANUP_INTERVAL_MS);

  // Notify applicants when their saved jobs are closing within 7 days.
  triggerSavedJobClosingNotifications().catch((e) =>
    logger.error(e, "Initial saved-job closing-soon check failed"),
  );
  setInterval(() => {
    triggerSavedJobClosingNotifications().catch((e) =>
      logger.error(e, "Scheduled saved-job closing-soon check failed"),
    );
  }, SAVED_JOB_CLOSING_INTERVAL_MS);

  escalateOverdueApprovals().catch((e) => logger.error(e, "Initial approval escalation failed"));
  setInterval(() => escalateOverdueApprovals().catch((e) => logger.error(e, "Scheduled approval escalation failed")), APPROVAL_ESCALATION_INTERVAL_MS);
});
