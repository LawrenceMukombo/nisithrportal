import { createContext, useState, useEffect, useCallback, useRef } from "react";
import { initApiAuth, getToken, setToken, clearToken, decodeToken } from "@/lib/api-config";
import { getSessionTimeoutMinutes } from "@/lib/session-timeout";

export interface AuthUser {
  userId: number;
  role: string;
  agencyId: number;
  email: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => void;
  logout: () => void;
  updateEmail: (newEmail: string) => void;
  role: string | null;
  agencyId: number | null;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initApiAuth();
    const stored = getToken();
    if (stored) {
      const payload = decodeToken(stored);
      if (payload) {
        setTokenState(stored);
        setUser({ userId: payload.userId, role: payload.roleName, agencyId: payload.agencyId, email: payload.email });
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((newToken: string) => {
    setToken(newToken);
    const payload = decodeToken(newToken);
    if (payload) {
      setTokenState(newToken);
      setUser({ userId: payload.userId, role: payload.roleName, agencyId: payload.agencyId, email: payload.email });
    }
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
  }, []);

  const updateEmail = useCallback((newEmail: string) => {
    setUser((prev) => prev ? { ...prev, email: newEmail } : prev);
  }, []);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!user) return;

    const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "visibilitychange",
    ];

    const clearTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    const scheduleLogout = () => {
      clearTimer();
      const minutes = getSessionTimeoutMinutes();
      if (minutes <= 0) return;
      idleTimerRef.current = setTimeout(() => {
        logout();
        try {
          sessionStorage.setItem("hr_portal_idle_logout", "1");
        } catch {}
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.assign("/login?reason=idle");
        }
      }, minutes * 60 * 1000);
    };

    const onActivity = () => scheduleLogout();
    const onTimeoutChanged = () => scheduleLogout();

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    window.addEventListener("hr-portal:session-timeout-changed", onTimeoutChanged);

    scheduleLogout();

    return () => {
      clearTimer();
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
      window.removeEventListener("hr-portal:session-timeout-changed", onTimeoutChanged);
    };
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      updateEmail,
      role: user?.role ?? null,
      agencyId: user?.agencyId ?? null,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

