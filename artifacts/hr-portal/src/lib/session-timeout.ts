export const SESSION_TIMEOUT_KEY = "hr_portal_session_timeout_minutes";

export const SESSION_TIMEOUT_OPTIONS = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 240, label: "4 hours" },
  { value: 0, label: "Never (stay signed in)" },
] as const;

export const DEFAULT_SESSION_TIMEOUT_MINUTES = 60;

export function getSessionTimeoutMinutes(): number {
  if (typeof window === "undefined") return DEFAULT_SESSION_TIMEOUT_MINUTES;
  const raw = localStorage.getItem(SESSION_TIMEOUT_KEY);
  if (raw == null) return DEFAULT_SESSION_TIMEOUT_MINUTES;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_SESSION_TIMEOUT_MINUTES;
  const allowed = SESSION_TIMEOUT_OPTIONS.map((o) => o.value);
  return allowed.includes(n as (typeof allowed)[number]) ? n : DEFAULT_SESSION_TIMEOUT_MINUTES;
}

export function setSessionTimeoutMinutes(minutes: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_TIMEOUT_KEY, String(minutes));
  window.dispatchEvent(new CustomEvent("hr-portal:session-timeout-changed", { detail: minutes }));
}
