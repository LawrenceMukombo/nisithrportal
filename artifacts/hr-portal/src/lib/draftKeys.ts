export const DRAFT_KEY_PREFIX = "apply_draft_";
export const DRAFT_KEY = (jobId: number) => `${DRAFT_KEY_PREFIX}${jobId}`;
