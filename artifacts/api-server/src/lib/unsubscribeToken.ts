import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;
if (!SECRET) {
  throw new Error("Neither JWT_SECRET nor SESSION_SECRET is set — unsubscribe tokens cannot be signed");
}
const effectiveSecret: string = SECRET;

export type UnsubscribePurpose = "saved-job-closing";

interface UnsubscribePayload {
  userId: number;
  purpose: UnsubscribePurpose;
}

export function signUnsubscribeToken(userId: number, purpose: UnsubscribePurpose): string {
  return jwt.sign({ userId, purpose } satisfies UnsubscribePayload, effectiveSecret, {
    expiresIn: "60d",
  });
}

export function verifyUnsubscribeToken(token: string, purpose: UnsubscribePurpose): number | null {
  try {
    const payload = jwt.verify(token, effectiveSecret) as Partial<UnsubscribePayload>;
    if (payload.purpose !== purpose) return null;
    if (typeof payload.userId !== "number") return null;
    return payload.userId;
  } catch {
    return null;
  }
}
