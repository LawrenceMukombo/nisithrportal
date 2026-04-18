import {
  FileText,
  Search,
  ClipboardList,
  MessageSquare,
  Star,
  Handshake,
  ShieldCheck,
  UserCheck2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface WorkflowStage {
  id: string;
  label: string;
  /** The DB status that represents this stage. */
  status: string;
  icon: LucideIcon;
  description: string;
  timeframe: string;
  color: string;
}

/**
 * All 8 recruitment pipeline stages in order.
 *
 * Two pairs of stages share a DB status:
 *   - CV Screening + Assessment  → "screening"
 *   - Interview + Evaluation     → "interview"
 *
 * Both stages in each pair count candidates at that status.
 * For the applicant timeline the FIRST stage that matches the status is
 * the "current" stage — so an applicant at "screening" is shown at
 * "CV Screening", and "interview" maps to "Interview".
 */
export const WORKFLOW_STAGES: WorkflowStage[] = [
  {
    id: "applied",
    label: "Application Received",
    status: "applied",
    icon: FileText,
    description: "Your application has been received and is queued for review by HR.",
    timeframe: "1–2 business days",
    color: "blue",
  },
  {
    id: "screening",
    label: "CV Screening",
    status: "screening",
    icon: Search,
    description: "HR is reviewing your CV and qualifications against the role requirements.",
    timeframe: "2–3 business days",
    color: "yellow",
  },
  {
    id: "assessment",
    label: "Assessment",
    status: "screening",
    icon: ClipboardList,
    description: "Shortlisted candidates may be asked to complete a written or skills-based assessment.",
    timeframe: "3–5 business days",
    color: "orange",
  },
  {
    id: "interview",
    label: "Interview",
    status: "interview",
    icon: MessageSquare,
    description: "You have been invited to interview with the hiring panel.",
    timeframe: "1–2 weeks",
    color: "purple",
  },
  {
    id: "evaluation",
    label: "Evaluation",
    status: "interview",
    icon: Star,
    description: "The panel is reviewing interview performance and contacting references.",
    timeframe: "3–5 business days",
    color: "indigo",
  },
  {
    id: "offer",
    label: "Offer Extended",
    status: "offer",
    icon: Handshake,
    description: "A formal job offer has been extended. Please review and respond within the given timeframe.",
    timeframe: "2–5 business days",
    color: "green",
  },
  {
    id: "background_check",
    label: "Background Check",
    status: "hired",
    icon: ShieldCheck,
    description: "Pre-employment background and reference verification is underway.",
    timeframe: "3–7 business days",
    color: "teal",
  },
  {
    id: "onboarding",
    label: "Onboarding",
    status: "onboarding",
    icon: UserCheck2,
    description: "Welcome to the team! Completing first-day paperwork and orientation steps.",
    timeframe: "1–2 weeks",
    color: "emerald",
  },
];

export const TERMINAL_STATUSES = ["rejected", "withdrawn"];

/**
 * Returns the index of the FIRST stage whose status matches the application status.
 * This is used for the applicant timeline so candidates at "screening" see
 * "CV Screening" (not "Assessment") and "interview" shows "Interview" (not "Evaluation").
 * Returns -1 for terminal statuses or unknown statuses.
 */
export function getActiveStageIndex(status: string): number {
  if (TERMINAL_STATUSES.includes(status)) return -1;
  return WORKFLOW_STAGES.findIndex((s) => s.status === status);
}

export function isStageComplete(stageIndex: number, activeIndex: number): boolean {
  return activeIndex >= 0 && stageIndex < activeIndex;
}

export function isStageCurrent(stageIndex: number, activeIndex: number): boolean {
  return stageIndex === activeIndex;
}

export const STAGE_COLOR_MAP: Record<string, { bg: string; text: string; border: string; ring: string }> = {
  blue:    { bg: "bg-blue-100",    text: "text-blue-700",    border: "border-blue-300",    ring: "ring-blue-400"    },
  yellow:  { bg: "bg-yellow-100",  text: "text-yellow-700",  border: "border-yellow-300",  ring: "ring-yellow-400"  },
  orange:  { bg: "bg-orange-100",  text: "text-orange-700",  border: "border-orange-300",  ring: "ring-orange-400"  },
  purple:  { bg: "bg-purple-100",  text: "text-purple-700",  border: "border-purple-300",  ring: "ring-purple-400"  },
  indigo:  { bg: "bg-indigo-100",  text: "text-indigo-700",  border: "border-indigo-300",  ring: "ring-indigo-400"  },
  green:   { bg: "bg-green-100",   text: "text-green-700",   border: "border-green-300",   ring: "ring-green-400"   },
  teal:    { bg: "bg-teal-100",    text: "text-teal-700",    border: "border-teal-300",    ring: "ring-teal-400"    },
  emerald: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300", ring: "ring-emerald-400" },
};

export const ALL_STATUS_OPTIONS = [
  { value: "applied",    label: "Applied"         },
  { value: "screening",  label: "CV Screening"    },
  { value: "interview",  label: "Interview"       },
  { value: "offer",      label: "Offer Extended"  },
  { value: "hired",      label: "Hired"           },
  { value: "onboarding", label: "Onboarding"      },
  { value: "rejected",   label: "Rejected"        },
  { value: "withdrawn",  label: "Withdrawn"       },
];
