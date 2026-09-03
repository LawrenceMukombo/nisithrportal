import app from "./app";
import { logger } from "./lib/logger";
import { seedInitialData, backfillMissingJobFields, backfillCandidateUserIds, ensureChatTablesExist, ensureContractColumnsExist, ensureLeaveTablesAndColumnsExist } from "./lib/seed";
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

  if (process.env["SEED_ON_STARTUP"] !== "false") {
    seedInitialData().catch((e) => logger.error(e, "Seed error"));
  }

  // Ensure WhatsApp-style messaging tables exist
  ensureChatTablesExist().catch((e) =>
    logger.error(e, "ensureChatTablesExist failed"),
  );

  // Ensure contract contents columns (salary, duties, specialConditions, etc.) exist
  ensureContractColumnsExist().catch((e) =>
    logger.error(e, "ensureContractColumnsExist failed"),
  );

  // Ensure expanded leave tables (public holidays, balance adjustments, handover columns) exist
  ensureLeaveTablesAndColumnsExist().catch((e) =>
    logger.error(e, "ensureLeaveTablesAndColumnsExist failed"),
  );

  // Always run the legacy job back-fill, independent of SEED_ON_STARTUP.
  // It is idempotent (only updates rows where employmentType/province IS NULL)
  // so it is safe to run on every boot, including in production where seeding
  // is disabled.
  backfillMissingJobFields().catch((e) =>
    logger.error(e, "backfillMissingJobFields failed"),
  );

  // Link legacy candidate records (created before Task #71) to their user
  // accounts by email. Idempotent — only touches rows with NULL user_id — so
  // it is safe to run on every boot. Reduces reliance on the slower email
  // fallback in /applications/my for existing users.
  backfillCandidateUserIds().catch((e) =>
    logger.error(e, "backfillCandidateUserIds failed"),
  );

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
