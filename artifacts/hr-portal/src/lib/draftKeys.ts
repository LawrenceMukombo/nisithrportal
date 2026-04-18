export const DRAFT_KEY_PREFIX = "apply_draft_";
export const DRAFT_KEY = (jobId: number) => `${DRAFT_KEY_PREFIX}${jobId}`;

export const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function draftRelativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (isNaN(ts)) return "Draft saved";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

export function isDraftExpired(savedAt: string | undefined | null): boolean {
  if (!savedAt) return false;
  const ts = new Date(savedAt).getTime();
  if (isNaN(ts)) return false;
  return Date.now() - ts > DRAFT_MAX_AGE_MS;
}
