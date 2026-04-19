import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust the first proxy hop so express-rate-limit reads the real client IP
// from X-Forwarded-For rather than the Replit proxy address.
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
app.use(cors());
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
