import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { initApiAuth, getToken, setToken, clearToken, decodeToken, type JwtPayload } from "@/lib/api-config";

export interface AuthUser {
  userId: number;
  role: string;
  agencyId: number;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
  role: string | null;
  agencyId: number | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

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

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!user,
      login,
      logout,
      role: user?.role ?? null,
      agencyId: user?.agencyId ?? null,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useRole() {
  const { role } = useAuth();
  return {
    isAdmin: role === "admin",
    isHR: role === "hr_officer",
    isHiringManager: role === "hiring_manager",
    isExecutive: role === "executive",
    isApplicant: role === "applicant",
    canViewCandidates: role === "hr_officer" || role === "hiring_manager" || role === "admin",
    canManageJobs: role === "hr_officer" || role === "admin",
    canManageEmployees: role === "hr_officer" || role === "admin",
    canManageContracts: role === "hr_officer" || role === "admin",
    canViewDashboard: role !== "applicant" && role !== null,
    canManageAgencies: role === "admin",
  };
}
