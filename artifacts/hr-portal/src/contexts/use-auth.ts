import { useContext } from "react";
import { AuthContext } from "./auth-context";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useRole() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const isHR = role === "hr_officer";
  const isHrOfficer = role === "hr_officer";
  const isHiringManager = role === "hiring_manager";
  const isExecutive = role === "executive";
  const isApplicant = role === "applicant";

  return {
    isAdmin,
    isHR,
    isHrOfficer,
    isHiringManager,
    isExecutive,
    isApplicant,
    canViewCandidates: isHrOfficer || isHiringManager || isAdmin,
    canManageJobs: isHrOfficer || isAdmin,
    canManageEmployees: isHrOfficer || isAdmin,
    canManageContracts: isHrOfficer || isAdmin,
    canViewDashboard: !isApplicant && role !== null,
    canManageAgencies: isAdmin,

    // Document signing & official institutional stamping
    canSignDocuments: isAdmin || isHrOfficer || isExecutive,
    canStampDocuments: isAdmin || isHrOfficer || isExecutive,

    // Recruitment workflow accountability permissions
    canScreenApplications: isAdmin || isHrOfficer || isHiringManager,
    canShortlistApplications: isAdmin || isHrOfficer || isHiringManager,
    canInterviewCandidates: isAdmin || isHrOfficer || isHiringManager,
    canIssueOffers: isAdmin || isHrOfficer,
    canHireCandidates: isAdmin || isHrOfficer || isExecutive,
  };
}
