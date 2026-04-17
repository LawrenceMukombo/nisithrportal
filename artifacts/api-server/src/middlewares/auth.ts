import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { logger } from "../lib/logger";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "test") {
    logger.warn("JWT_SECRET not set — using test-only fallback. Never deploy without JWT_SECRET.");
  } else {
    logger.error("JWT_SECRET environment variable is not set — cannot start the server");
    process.exit(1);
  }
}

const effectiveSecret: string = JWT_SECRET ?? "hr-portal-test-only-secret";

export interface JwtPayload {
  userId: number;
  email: string;
  roleId: number | null;
  agencyId: number | null;
  roleName: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, effectiveSecret) as JwtPayload;
      req.user = payload;
    } catch {
      // Token invalid — proceed unauthenticated
    }
  }
  next();
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: No token provided" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, effectiveSecret) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!req.user.roleName || !roles.includes(req.user.roleName)) {
      res.status(403).json({ error: `Forbidden: Requires one of roles: ${roles.join(", ")}` });
      return;
    }
    next();
  };
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, effectiveSecret, { expiresIn: "7d" });
}

export function parseIntParam(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  const n = parseInt(str, 10);
  return n;
}
