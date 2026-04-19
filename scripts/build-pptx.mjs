import PptxGenJS from "pptxgenjs";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const OUT = "docs/PNG_NISIT_HR_Portal.pptx";
mkdirSync(dirname(OUT), { recursive: true });

const pres = new PptxGenJS();
pres.layout = "LAYOUT_WIDE";
pres.title = "PNG NISIT HR Portal";
pres.company = "PNG NISIT";

const NAVY = "0B2545";
const GOLD = "C9A227";
const LIGHT = "F4F6F8";
const TEXT = "1F2937";
const MUTED = "6B7280";
const ACCENT = "1E6091";

function addBaseSlide(title, subtitle) {
  const slide = pres.addSlide();
  slide.background = { color: "FFFFFF" };
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.5, fill: { color: NAVY } });
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 0.5, w: 13.33, h: 0.06, fill: { color: GOLD } });
  slide.addText("PNG NISIT HR Portal", {
    x: 0.4, y: 0.05, w: 8, h: 0.4,
    fontSize: 12, color: "FFFFFF", fontFace: "Calibri", bold: true,
  });
  slide.addText("Confidential · Stakeholder Brief", {
    x: 8.5, y: 0.05, w: 4.5, h: 0.4,
    fontSize: 10, color: "FFFFFF", fontFace: "Calibri", align: "right", italic: true,
  });
  slide.addText(title, {
    x: 0.5, y: 0.75, w: 12.3, h: 0.6,
    fontSize: 28, bold: true, color: NAVY, fontFace: "Calibri",
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5, y: 1.35, w: 12.3, h: 0.4,
      fontSize: 14, color: MUTED, fontFace: "Calibri", italic: true,
    });
  }
  return slide;
}

function addBullets(slide, items, opts = {}) {
  const x = opts.x ?? 0.6;
  const y = opts.y ?? 1.9;
  const w = opts.w ?? 12.1;
  const h = opts.h ?? 5.3;
  const text = items.map((item) => {
    if (typeof item === "string") {
      return { text: item, options: { bullet: { code: "25A0" }, color: TEXT, fontSize: 16, paraSpaceAfter: 8 } };
    }
    return {
      text: item.text,
      options: {
        bullet: item.sub ? { indent: 28, code: "2022" } : { code: "25A0" },
        color: item.sub ? MUTED : TEXT,
        fontSize: item.sub ? 13 : 16,
        bold: item.bold ?? false,
        paraSpaceAfter: 6,
        indentLevel: item.sub ? 1 : 0,
      },
    };
  });
  slide.addText(text, { x, y, w, h, fontFace: "Calibri", valign: "top" });
}

// ── Slide 1: Title ────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: NAVY };
  s.addShape(pres.ShapeType.rect, { x: 0, y: 4.0, w: 13.33, h: 0.08, fill: { color: GOLD } });
  s.addText("PNG NISIT HR Portal", {
    x: 0.5, y: 1.6, w: 12.3, h: 1.2,
    fontSize: 54, bold: true, color: "FFFFFF", fontFace: "Calibri",
  });
  s.addText("AI-Enabled Recruitment & Workforce Management Platform", {
    x: 0.5, y: 2.9, w: 12.3, h: 0.7,
    fontSize: 22, color: GOLD, fontFace: "Calibri", italic: true,
  });
  s.addText("Stakeholder Briefing  ·  April 2026  ·  Version 1.1", {
    x: 0.5, y: 4.3, w: 12.3, h: 0.4,
    fontSize: 14, color: "FFFFFF", fontFace: "Calibri",
  });
  s.addText("Single-Tenant Deployment — Exclusively for the Papua New Guinea National Institute of Standards and Industrial Technology", {
    x: 0.5, y: 6.4, w: 12.3, h: 0.6,
    fontSize: 13, color: "C9D1D9", fontFace: "Calibri", italic: true,
  });
}

// ── Slide 2: Executive Summary ───────────────────────────────────
{
  const s = addBaseSlide("Executive Summary", "Why this platform, and what it delivers for PNG NISIT");
  addBullets(s, [
    "Purpose-built recruitment & workforce management platform, deployed exclusively for PNG NISIT.",
    "Modernises the entire hiring lifecycle — from public job advertising through to onboarding and contract management.",
    "Applies AI to reduce manual screening effort and improve decision quality.",
    "Consolidates work that today lives across spreadsheets, email inboxes and disparate tools into one auditable system.",
    "Government-grade audit logging and role-based access on every endpoint.",
    { text: "Single-tenant lock", bold: true },
    { text: "Every job, application, candidate and contract belongs to PNG NISIT.", sub: true },
    { text: "Underlying multi-agency architecture preserved — re-enable later if NISIT expands the platform to partner agencies.", sub: true },
  ]);
}

// ── Slide 3: Who It's For ────────────────────────────────────────
{
  const s = addBaseSlide("Who It Is For", "Primary audiences and the value each receives");
  const rows = [
    [{ text: "Audience", options: { bold: true, color: "FFFFFF", fill: { color: NAVY } } },
     { text: "Primary Benefit", options: { bold: true, color: "FFFFFF", fill: { color: NAVY } } }],
    ["PNG NISIT HR Team", "Streamlined hiring, less paperwork, defensible audit trails"],
    ["PNG NISIT Hiring Managers", "Faster shortlists, AI-ranked candidates, better interview prep"],
    ["PNG NISIT Executive Leadership", "Real-time workforce visibility and attrition forecasting"],
    ["System Administrators", "User & integration management, compliance reporting"],
    ["Job Applicants (Public)", "Modern, mobile-friendly application experience for NISIT vacancies"],
  ];
  s.addTable(rows, {
    x: 0.6, y: 1.9, w: 12.1,
    colW: [4.0, 8.1],
    fontSize: 14, fontFace: "Calibri",
    border: { type: "solid", pt: 1, color: "E5E7EB" },
    rowH: 0.6,
  });
}

// ── Slide 4: Public Career Portal ────────────────────────────────
{
  const s = addBaseSlide("Public Career Portal & Application Wizard", "A modern, branded experience for NISIT applicants");
  addBullets(s, [
    "NISIT-branded public landing page listing all open NISIT vacancies.",
    "Filter by department, location and employment type.",
    "“Save Job” feature with optional closing-soon email reminders (configurable: 3, 7 or 14 days ahead).",
    "8-step guided application wizard:",
    { text: "Personal & contact details, availability, education, experience & skills.", sub: true },
    { text: "Document uploads (CV, cover letter, certificates).", sub: true },
    { text: "Job-specific screening questions with auto-reject for mandatory criteria.", sub: true },
    { text: "Legal declarations (privacy consent, background check, conflict of interest).", sub: true },
    "Auto-save drafts so applicants can resume later.",
    "Real-time application status tracking.",
  ]);
}

// ── Slide 5: AI-Assisted Recruitment ─────────────────────────────
{
  const s = addBaseSlide("AI-Assisted Recruitment", "Reduce screening time and surface the best candidates");
  addBullets(s, [
    { text: "Automatic CV parsing", bold: true },
    { text: "Extracts skills, experience and education from PDF and DOCX uploads.", sub: true },
    { text: "Candidate ranking", bold: true },
    { text: "Scores applicants against the specific job description and surfaces best-fit candidates first.", sub: true },
    { text: "Interview question generator", bold: true },
    { text: "Produces targeted interview questions tailored to each candidate and role.", sub: true },
    { text: "Workforce forecasting", bold: true },
    { text: "Predictive insight into upcoming vacancies and attrition risk.", sub: true },
  ]);
}

// ── Slide 6: Recruitment Workflow ────────────────────────────────
{
  const s = addBaseSlide("End-to-End Recruitment Workflow", "From job posting to hire — without spreadsheets");
  addBullets(s, [
    "Create, publish, close and re-post jobs.",
    "Configurable screening questions with auto-reject logic for mandatory criteria.",
    "Pipeline: Applied → Shortlisted → Interview → Offer → Hired / Rejected.",
    "Bulk actions with server-side filter support — operate on entire filter results, not just visible rows.",
    "Confirmation safeguards on bulk actions, with live match counts before any change is committed.",
    "Internal notes, scoring and tagging on every application.",
    "Stage-by-stage pipeline visualisation and status history.",
  ]);
}

// ── Slide 7: Pipeline Diagram ────────────────────────────────────
{
  const s = addBaseSlide("Recruitment Pipeline at a Glance", "Every applicant moves through a tracked, auditable workflow");
  const stages = ["Applied", "Shortlisted", "Interview", "Offer", "Hired"];
  const colors = [ACCENT, ACCENT, ACCENT, GOLD, "2E7D32"];
  const totalW = 12.3;
  const stageW = (totalW - (stages.length - 1) * 0.2) / stages.length;
  stages.forEach((label, i) => {
    const x = 0.5 + i * (stageW + 0.2);
    s.addShape(pres.ShapeType.chevron, {
      x, y: 3.0, w: stageW, h: 1.2,
      fill: { color: colors[i] }, line: { color: colors[i] },
    });
    s.addText(label, {
      x, y: 3.0, w: stageW, h: 1.2,
      fontSize: 18, bold: true, color: "FFFFFF",
      align: "center", valign: "middle", fontFace: "Calibri",
    });
  });
  s.addText("Every status change records who, when, and why — feeding the audit trail and SLA reporting.", {
    x: 0.5, y: 5.0, w: 12.3, h: 0.5,
    fontSize: 14, color: MUTED, italic: true, fontFace: "Calibri", align: "center",
  });
}

// ── Slide 8: Offer Letters & Contracts ───────────────────────────
{
  const s = addBaseSlide("Offer Letters & Contract Management", "Branded, tracked, and safe to send");
  addBullets(s, [
    "Branded PDF offer letter generation.",
    "One-click send to candidate via email, with confirm-before-send safeguards.",
    "Resend protection — warns if an offer letter was sent within the last 24 hours.",
    "Complete send history per application: who sent it, when, and to which email.",
    "Contract lifecycle management (Fixed-term, Permanent, Casual).",
    "Signed-contract upload with reason-tracked replacement and removal.",
    "Automated contract expiry alerts (30 days ahead).",
  ]);
}

// ── Slide 9: Document Management ─────────────────────────────────
{
  const s = addBaseSlide("Document Management", "Secure storage with full chain of custody");
  addBullets(s, [
    "Secure object storage for CVs, cover letters, certificates and signed contracts.",
    "Access-control policies prevent unauthorised retrieval.",
    "Removed-document audit trail with mandatory reason capture for sensitive removals.",
    "Document version history.",
    "Reason capture on contract document replacement.",
  ]);
}

// ── Slide 10: Notifications ──────────────────────────────────────
{
  const s = addBaseSlide("Notifications & Communication", "Right message, right person, with respect for inboxes");
  addBullets(s, [
    "Status-update emails to applicants at each pipeline stage.",
    "Stalled-application alerts to hiring managers (with one-click unsubscribe).",
    "Saved-job closing-soon reminders with per-user opt-in and frequency control.",
    "RFC 8058 one-click unsubscribe links — Gmail and Outlook compatible.",
    "In-app notification bell for HR (new applications, contract expiry, etc.).",
    "Per-user notification preferences.",
  ]);
}

// ── Slide 11: RBAC ───────────────────────────────────────────────
{
  const s = addBaseSlide("Role-Based Access Control", "Five clear roles, scoped permissions on every endpoint");
  const rows = [
    [{ text: "Role", options: { bold: true, color: "FFFFFF", fill: { color: NAVY } } },
     { text: "Responsibilities", options: { bold: true, color: "FFFFFF", fill: { color: NAVY } } }],
    ["System Admin", "Full oversight, user management, integrations"],
    ["HR Officer", "Day-to-day recruitment operations and contract administration"],
    ["Hiring Manager", "Review shortlists and AI-ranked candidates for their roles"],
    ["Executive Leadership", "Workforce analytics and forecasting dashboards"],
    ["Applicant", "Self-service public access — apply, track, manage profile"],
  ];
  s.addTable(rows, {
    x: 0.6, y: 1.9, w: 12.1,
    colW: [3.5, 8.6],
    fontSize: 14, fontFace: "Calibri",
    border: { type: "solid", pt: 1, color: "E5E7EB" },
    rowH: 0.55,
  });
}

// ── Slide 12: Audit & Compliance ─────────────────────────────────
{
  const s = addBaseSlide("Audit & Compliance", "Designed for PNG government accountability");
  addBullets(s, [
    "Comprehensive audit trail for every administrative action — logins, status changes, document removals, offer sends, AI-ranking clears.",
    "Searchable, filterable audit log view.",
    "Status-history tracking with the user who made each change.",
    "Reason capture on sensitive operations (document removal, contract replacement).",
    "Designed to support PNG government PII handling and accountability requirements.",
  ]);
}

// ── Slide 13: Analytics ──────────────────────────────────────────
{
  const s = addBaseSlide("Analytics & Reporting", "Decisions backed by data");
  addBullets(s, [
    "Vacancy vs. filled-position dashboards.",
    "Recruitment funnel and time-to-hire metrics.",
    "Staff distribution by department, location and employment type.",
    "AI-powered workforce forecasting.",
    "Exportable reports with filter context preserved.",
  ]);
}

// ── Slide 14: Single-Tenant Deployment ───────────────────────────
{
  const s = addBaseSlide("Single-Tenant Deployment for PNG NISIT", "Locked to NISIT today, ready for tomorrow");
  addBullets(s, [
    "Platform locked to PNG NISIT — every job, application, employee and contract belongs to NISIT.",
    "All API endpoints enforce the NISIT scope server-side, regardless of caller.",
    "Public job board, application portal and admin tools are all branded and scoped to NISIT.",
    "Underlying multi-tenant architecture is preserved in the codebase.",
    { text: "Future-ready", bold: true },
    { text: "Multi-agency mode can be re-enabled in a future phase if PNG NISIT chooses to extend the platform to partner agencies — without re-engineering.", sub: true },
  ]);
}

// ── Slide 15: Differentiators ────────────────────────────────────
{
  const s = addBaseSlide("Differentiators", "Where PNG NISIT HR Portal stands apart");
  const rows = [
    [{ text: "", options: { fill: { color: NAVY } } },
     { text: "Traditional HR Systems", options: { bold: true, color: "FFFFFF", fill: { color: NAVY } } },
     { text: "PNG NISIT HR Portal", options: { bold: true, color: "FFFFFF", fill: { color: NAVY } } }],
    ["Setup for NISIT", "Generic, requires customisation", "Built specifically for PNG NISIT"],
    ["AI Screening", "Add-on or absent", "Built-in CV parsing, ranking, interview prep"],
    ["Audit Logging", "Often partial", "Comprehensive, with reason capture"],
    ["Public Application UX", "Long, single-page forms", "Modern 8-step wizard with auto-save"],
    ["Offer Letter Workflow", "Manual Word documents", "Branded PDF, tracked, one-click send"],
    ["Notifications", "Bulk, no opt-out", "Per-user controls, RFC 8058 unsubscribe"],
    ["Future-proofing", "Locked architecture", "Multi-agency capable if NISIT later expands scope"],
  ];
  s.addTable(rows, {
    x: 0.4, y: 1.85, w: 12.5,
    colW: [3.0, 4.5, 5.0],
    fontSize: 12, fontFace: "Calibri",
    border: { type: "solid", pt: 1, color: "E5E7EB" },
    rowH: 0.5,
  });
}

// ── Slide 16: Security ───────────────────────────────────────────
{
  const s = addBaseSlide("Security & Compliance", "Government-grade by design");
  addBullets(s, [
    "Encrypted secrets and credentials via managed environment variables.",
    "All data access scoped to PNG NISIT and enforced at the API layer.",
    "All sensitive document operations recorded with actor, timestamp and reason.",
    "Role-based access enforced on every endpoint.",
    "Rate limiting and signed tokens on public-facing actions (e.g. unsubscribe).",
    "Object storage with access-control policies.",
    "JWT-based authentication with secure password reset flow.",
  ]);
}

// ── Slide 17: Architecture ───────────────────────────────────────
{
  const s = addBaseSlide("Architecture at a Glance", "Modern, modular, cloud-hosted");
  const blocks = [
    { label: "Web Portal\n(React)", x: 0.6 },
    { label: "Public API\n(Node.js / Express)", x: 4.0 },
    { label: "PostgreSQL\nDatabase", x: 7.4 },
    { label: "Object Storage\n(Documents)", x: 10.8 },
  ];
  blocks.forEach((b) => {
    s.addShape(pres.ShapeType.roundRect, {
      x: b.x, y: 2.2, w: 2.0, h: 1.4,
      fill: { color: NAVY }, line: { color: NAVY }, rectRadius: 0.1,
    });
    s.addText(b.label, {
      x: b.x, y: 2.2, w: 2.0, h: 1.4,
      fontSize: 13, color: "FFFFFF", bold: true,
      align: "center", valign: "middle", fontFace: "Calibri",
    });
  });
  // AI layer below
  s.addShape(pres.ShapeType.roundRect, {
    x: 2.6, y: 4.3, w: 8.0, h: 1.0,
    fill: { color: GOLD }, line: { color: GOLD }, rectRadius: 0.1,
  });
  s.addText("AI Layer  ·  CV Parsing  ·  Candidate Ranking  ·  Workforce Forecasting", {
    x: 2.6, y: 4.3, w: 8.0, h: 1.0,
    fontSize: 14, bold: true, color: NAVY,
    align: "center", valign: "middle", fontFace: "Calibri",
  });
  s.addText("Hosted in the cloud with TLS, automatic scaling, and health checks. Email delivered via SMTP with branded templates.", {
    x: 0.5, y: 5.8, w: 12.3, h: 0.5,
    fontSize: 13, color: MUTED, italic: true, fontFace: "Calibri", align: "center",
  });
}

// ── Slide 18: Roadmap ────────────────────────────────────────────
{
  const s = addBaseSlide("Roadmap Themes", "What's next for the platform");
  addBullets(s, [
    "Expanded analytics — diversity reporting, source-of-hire effectiveness.",
    "Mobile applicant experience enhancements.",
    "Additional integration connectors (payroll, identity providers).",
    "Advanced workforce planning scenarios.",
    "Localisation for additional languages.",
    "Optional future expansion to partner government agencies (multi-agency mode), should PNG NISIT choose to extend the platform.",
  ]);
}

// ── Slide 19: Closing ────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: NAVY };
  s.addShape(pres.ShapeType.rect, { x: 0, y: 3.4, w: 13.33, h: 0.08, fill: { color: GOLD } });
  s.addText("Thank You", {
    x: 0.5, y: 2.2, w: 12.3, h: 1.0,
    fontSize: 60, bold: true, color: "FFFFFF", fontFace: "Calibri", align: "center",
  });
  s.addText("Questions, demos and onboarding enquiries welcome.", {
    x: 0.5, y: 3.7, w: 12.3, h: 0.6,
    fontSize: 18, color: GOLD, fontFace: "Calibri", align: "center", italic: true,
  });
  s.addText("PNG NISIT HR Portal  ·  Stakeholder Briefing  ·  April 2026", {
    x: 0.5, y: 6.6, w: 12.3, h: 0.4,
    fontSize: 12, color: "C9D1D9", fontFace: "Calibri", align: "center",
  });
}

await pres.writeFile({ fileName: OUT });
console.log(`Wrote ${OUT}`);
