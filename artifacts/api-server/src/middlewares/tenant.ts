import type { Request, Response } from "express";
import { NISIT_AGENCY_ID } from "../lib/single-tenant";

export function getTenantAgencyId(req: Request): number | null {
  return req.user?.agencyId ?? NISIT_AGENCY_ID;
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
