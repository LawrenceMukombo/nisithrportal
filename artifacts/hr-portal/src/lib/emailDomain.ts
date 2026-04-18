const STAFF_DOMAINS = (import.meta.env.VITE_STAFF_EMAIL_DOMAINS ?? "gov.pg")
  .split(",")
  .map((d: string) => d.trim().toLowerCase())
  .filter(Boolean) as string[];

export const STAFF_ROLES = new Set(["admin", "hr_officer", "hiring_manager", "executive"]);

export function isStaffDomain(email: string): boolean {
  const atIdx = email.lastIndexOf("@");
  if (atIdx === -1) return false;
  const emailDomain = email.slice(atIdx + 1).toLowerCase();
  return STAFF_DOMAINS.some(
    (domain) => emailDomain === domain || emailDomain.endsWith(`.${domain}`),
  );
}

export function isApplicantDomain(email: string): boolean {
  return !isStaffDomain(email);
}

export function getStaffDomainsList(): string {
  return STAFF_DOMAINS.join(", ");
}
