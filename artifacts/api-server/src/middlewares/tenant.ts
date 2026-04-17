import type { Request, Response } from "express";

export function getTenantAgencyId(req: Request): number | null {
  return req.user?.agencyId ?? null;
}

export function assertTenantAccess(res: Response, resourceAgencyId: number | null, userAgencyId: number | null): boolean {
  if (userAgencyId == null) return true;

  if (resourceAgencyId == null) {
    res.status(403).json({ error: "Forbidden: resource has no agency ownership" });
    return false;
  }

  if (resourceAgencyId !== userAgencyId) {
    res.status(403).json({ error: "Forbidden: resource belongs to a different agency" });
    return false;
  }

  return true;
}
