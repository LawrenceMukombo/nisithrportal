import { useContext } from "react";
import { AuthContext } from "./auth-context";

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
    isHrOfficer: role === "hr_officer",
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
