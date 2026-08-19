import { setAuthTokenGetter } from "@workspace/api-client-react";

export const TOKEN_KEY = "hr_portal_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getAuthHeader(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  setAuthTokenGetter(() => token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  setAuthTokenGetter(null);
}

export function initApiAuth(): void {
  const token = getToken();
  if (token) {
    setAuthTokenGetter(() => token);
  }
}

export interface JwtPayload {
  userId: number;
  roleName: string;
  agencyId: number;
  email: string;
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload as JwtPayload;
  } catch {
    return null;
  }
}
