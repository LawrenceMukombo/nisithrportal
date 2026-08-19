import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust the first proxy hop so express-rate-limit reads the real client IP
// from X-Forwarded-For when behind a reverse proxy.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const configuredOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    // Browsers omit Origin for same-origin and non-browser requests.
    if (!origin || configuredOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS policy"));
  },
}));
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // The API serves data, not executable web pages. A restrictive CSP limits the
  // impact of accidental content-type mistakes and blocks framing everywhere.
  res.setHeader("Content-Security-Policy", "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use((err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  logger.error({ err, url: req.url, method: req.method }, "Unhandled error");

  function getPgCode(e: unknown): string | undefined {
    if (!e || typeof e !== "object") return undefined;
    const err = e as Record<string, unknown>;
    if (typeof err.code === "string") return err.code;
    if (err.cause) return getPgCode(err.cause);
    return undefined;
  }

  const code = getPgCode(err);
  if (code === "23503") {
    res.status(400).json({ error: "Referenced record does not exist (foreign key constraint)" });
    return;
  }
  if (code === "23505") {
    res.status(409).json({ error: "Conflict: a record with that key already exists" });
    return;
  }

  res.status(500).json({ error: "Internal server error" });
});

export default app;
