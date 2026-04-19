import app from "./app";
import { logger } from "./lib/logger";
import { seedInitialData } from "./lib/seed";
import { triggerContractExpiryNotifications } from "./routes/contracts";
import { cleanupExpiredResetTokens } from "./routes/auth";
import { verifySMTPConnection } from "./lib/email";

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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Verify SMTP connectivity on startup and warn about missing configuration.
  const appBaseUrlSet = !!(process.env["APP_BASE_URL"] || process.env["REPLIT_DEV_DOMAIN"]);
  if (!appBaseUrlSet) {
    logger.warn("APP_BASE_URL and REPLIT_DEV_DOMAIN are both unset — password-reset links cannot be constructed. Set APP_BASE_URL to the production frontend origin.");
  }
  verifySMTPConnection().catch((e) =>
    logger.error(e, "Startup SMTP verification failed"),
  );

  if (process.env["SEED_ON_STARTUP"] !== "false") {
    seedInitialData().catch((e) => logger.error(e, "Seed error"));
  }

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
});
