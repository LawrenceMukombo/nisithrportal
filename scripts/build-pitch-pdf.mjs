import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, "..", "docs", "PNG_NISIT_HR_Portal_Pitch.pdf");

const COLORS = {
  primary: "#B22234",
  primaryDark: "#7A0E1F",
  accent: "#0B5394",
  ink: "#111827",
  body: "#374151",
  muted: "#6B7280",
  line: "#E5E7EB",
  bgSoft: "#F9FAFB",
  bgAccent: "#FEF2F2",
  green: "#15803D",
  amber: "#B45309",
};

const PAGE = { width: 612, height: 792, margin: 54 };
const CONTENT_W = PAGE.width - PAGE.margin * 2;

const doc = new PDFDocument({
  size: [PAGE.width, PAGE.height],
  margin: PAGE.margin,
  bufferPages: true,
  info: {
    Title: "PNG NISIT HR Portal — Stakeholder & Sponsor Pitch",
    Author: "PNG NISIT IT Department",
    Subject: "AI-Enabled Government HR Recruitment & Workforce Management",
    Keywords: "PNG NISIT, HR Portal, Recruitment, Workforce, AI, Government",
  },
});

doc.pipe(fs.createWriteStream(OUT_PATH));

function setFillHex(hex) { doc.fillColor(hex); }
function setStrokeHex(hex) { doc.strokeColor(hex); }

function header(title, subtitle) {
  const y = 36;
  setFillHex(COLORS.primary);
  doc.rect(0, 0, PAGE.width, 6).fill();
  setFillHex(COLORS.ink);
  doc.font("Helvetica-Bold").fontSize(10).text("PNG NISIT HR PORTAL", PAGE.margin, y, { lineBreak: false });
  setFillHex(COLORS.muted);
  doc.font("Helvetica").fontSize(9).text("Stakeholder & Sponsor Pitch", PAGE.margin, y, { width: CONTENT_W, align: "right", lineBreak: false });
  if (title) {
    doc.moveDown(2);
    setFillHex(COLORS.ink);
    doc.font("Helvetica-Bold").fontSize(20).text(title, PAGE.margin, 64);
  }
  if (subtitle) {
    setFillHex(COLORS.muted);
    doc.font("Helvetica").fontSize(11).text(subtitle, PAGE.margin, doc.y + 2);
  }
  setStrokeHex(COLORS.line);
  doc.moveTo(PAGE.margin, doc.y + 8).lineTo(PAGE.width - PAGE.margin, doc.y + 8).lineWidth(0.75).stroke();
  doc.moveDown(1.2);
}

function footer(pageNum, total) {
  const y = PAGE.height - 30;
  setStrokeHex(COLORS.line);
  doc.moveTo(PAGE.margin, y - 8).lineTo(PAGE.width - PAGE.margin, y - 8).lineWidth(0.5).stroke();
  setFillHex(COLORS.muted);
  doc.font("Helvetica").fontSize(8).text(`PNG NISIT HR Portal — Pitch Document  ·  April 2026  ·  Confidential`, PAGE.margin, y, { width: CONTENT_W, lineBreak: false });
  doc.text(`Page ${pageNum} of ${total}`, PAGE.margin, y, { width: CONTENT_W, align: "right", lineBreak: false });
}

function ensureSpace(neededPx) {
  if (doc.y + neededPx > PAGE.height - 60) {
    doc.addPage();
    header();
  }
}

function sectionTitle(num, title) {
  ensureSpace(60);
  setFillHex(COLORS.primary);
  doc.rect(PAGE.margin, doc.y, 4, 22).fill();
  setFillHex(COLORS.ink);
  doc.font("Helvetica-Bold").fontSize(15).text(`${num}.  ${title}`, PAGE.margin + 12, doc.y - 22 + 4, { width: CONTENT_W - 12 });
  doc.moveDown(0.6);
}

function subsection(title) {
  ensureSpace(30);
  setFillHex(COLORS.accent);
  doc.font("Helvetica-Bold").fontSize(11).text(title, { width: CONTENT_W });
  doc.moveDown(0.3);
}

function paragraph(text, opts = {}) {
  ensureSpace(40);
  setFillHex(opts.color ?? COLORS.body);
  doc.font(opts.font ?? "Helvetica").fontSize(opts.size ?? 10.5);
  doc.text(text, { width: CONTENT_W, align: opts.align ?? "left", lineGap: 2 });
  doc.moveDown(opts.gap ?? 0.6);
}

function bullet(text) {
  ensureSpace(20);
  const x = PAGE.margin;
  const y = doc.y + 4;
  setFillHex(COLORS.primary);
  doc.circle(x + 4, y + 3, 2).fill();
  setFillHex(COLORS.body);
  doc.font("Helvetica").fontSize(10.5);
  doc.text(text, x + 14, y - 2, { width: CONTENT_W - 14, lineGap: 2 });
  doc.moveDown(0.35);
}

function calloutBox(label, body, tone = "primary") {
  ensureSpace(80);
  const palette = {
    primary: { bg: COLORS.bgAccent, border: COLORS.primary, label: COLORS.primaryDark },
    accent: { bg: "#EFF6FF", border: COLORS.accent, label: COLORS.accent },
    success: { bg: "#F0FDF4", border: COLORS.green, label: COLORS.green },
    warn: { bg: "#FFFBEB", border: COLORS.amber, label: COLORS.amber },
  }[tone];
  const x = PAGE.margin;
  const y = doc.y;
  // measure body
  doc.font("Helvetica").fontSize(10.5);
  const bodyH = doc.heightOfString(body, { width: CONTENT_W - 24 });
  const labelH = label ? 16 : 0;
  const h = Math.max(40, bodyH + labelH + 18);
  setFillHex(palette.bg);
  doc.roundedRect(x, y, CONTENT_W, h, 6).fill();
  setStrokeHex(palette.border);
  doc.roundedRect(x, y, CONTENT_W, h, 6).lineWidth(0.75).stroke();
  setFillHex(palette.border);
  doc.rect(x, y, 4, h).fill();
  if (label) {
    setFillHex(palette.label);
    doc.font("Helvetica-Bold").fontSize(9).text(label.toUpperCase(), x + 12, y + 8, { width: CONTENT_W - 24, characterSpacing: 0.6 });
  }
  setFillHex(COLORS.ink);
  doc.font("Helvetica").fontSize(10.5).text(body, x + 12, y + 8 + labelH, { width: CONTENT_W - 24, lineGap: 2 });
  doc.y = y + h + 10;
}

function statTiles(stats) {
  ensureSpace(110);
  const gap = 10;
  const tileW = (CONTENT_W - gap * (stats.length - 1)) / stats.length;
  const tileH = 84;
  const startY = doc.y;
  stats.forEach((s, i) => {
    const x = PAGE.margin + i * (tileW + gap);
    setFillHex(COLORS.bgSoft);
    doc.roundedRect(x, startY, tileW, tileH, 6).fill();
    setStrokeHex(COLORS.line);
    doc.roundedRect(x, startY, tileW, tileH, 6).lineWidth(0.5).stroke();
    setFillHex(COLORS.primary);
    doc.font("Helvetica-Bold").fontSize(22).text(s.value, x + 12, startY + 12, { width: tileW - 24, lineBreak: false });
    setFillHex(COLORS.ink);
    doc.font("Helvetica-Bold").fontSize(9).text(s.label, x + 12, startY + 44, { width: tileW - 24, characterSpacing: 0.4 });
    setFillHex(COLORS.muted);
    doc.font("Helvetica").fontSize(8).text(s.sub, x + 12, startY + 58, { width: tileW - 24, lineGap: 1 });
  });
  doc.y = startY + tileH + 14;
}

function table(rows, opts = {}) {
  const widths = opts.widths;
  const totalW = widths.reduce((a, b) => a + b, 0);
  const scale = CONTENT_W / totalW;
  const colW = widths.map((w) => w * scale);
  const padX = 8;
  const padY = 6;
  const headerH = 22;
  // header
  ensureSpace(headerH + 30);
  let y = doc.y;
  setFillHex(COLORS.primary);
  doc.rect(PAGE.margin, y, CONTENT_W, headerH).fill();
  setFillHex("#FFFFFF");
  doc.font("Helvetica-Bold").fontSize(9.5);
  let x = PAGE.margin;
  rows[0].forEach((c, i) => {
    doc.text(String(c), x + padX, y + padY, { width: colW[i] - padX * 2, lineBreak: false });
    x += colW[i];
  });
  y += headerH;
  // body
  for (let r = 1; r < rows.length; r++) {
    doc.font("Helvetica").fontSize(10);
    // measure row height
    let rowH = 0;
    rows[r].forEach((c, i) => {
      const h = doc.heightOfString(String(c), { width: colW[i] - padX * 2, lineGap: 1 });
      if (h > rowH) rowH = h;
    });
    rowH += padY * 2;
    if (y + rowH > PAGE.height - 70) {
      doc.addPage();
      header();
      y = doc.y;
      // re-render header
      setFillHex(COLORS.primary);
      doc.rect(PAGE.margin, y, CONTENT_W, headerH).fill();
      setFillHex("#FFFFFF");
      doc.font("Helvetica-Bold").fontSize(9.5);
      x = PAGE.margin;
      rows[0].forEach((c, i) => {
        doc.text(String(c), x + padX, y + padY, { width: colW[i] - padX * 2, lineBreak: false });
        x += colW[i];
      });
      y += headerH;
    }
    setFillHex(r % 2 === 1 ? "#FFFFFF" : COLORS.bgSoft);
    doc.rect(PAGE.margin, y, CONTENT_W, rowH).fill();
    setStrokeHex(COLORS.line);
    doc.moveTo(PAGE.margin, y + rowH).lineTo(PAGE.margin + CONTENT_W, y + rowH).lineWidth(0.4).stroke();
    setFillHex(COLORS.ink);
    x = PAGE.margin;
    doc.font("Helvetica").fontSize(10);
    rows[r].forEach((c, i) => {
      doc.text(String(c), x + padX, y + padY, { width: colW[i] - padX * 2, lineGap: 1 });
      x += colW[i];
    });
    y += rowH;
  }
  doc.y = y + 12;
}

// ========================================================================
// COVER PAGE
// ========================================================================

setFillHex(COLORS.primary);
doc.rect(0, 0, PAGE.width, 240).fill();
setFillHex(COLORS.primaryDark);
doc.rect(0, 220, PAGE.width, 20).fill();

setFillHex("#FFFFFF");
doc.font("Helvetica-Bold").fontSize(11).text("PAPUA NEW GUINEA NATIONAL INSTITUTE", PAGE.margin, 70, { characterSpacing: 1.2 });
doc.font("Helvetica").fontSize(11).text("OF STANDARDS AND INDUSTRIAL TECHNOLOGY", PAGE.margin, 86, { characterSpacing: 1.2 });

doc.font("Helvetica-Bold").fontSize(34).fillColor("#FFFFFF").text("HR Portal", PAGE.margin, 120);
doc.font("Helvetica").fontSize(18).fillColor("#FCE7E9").text("AI-Enabled Recruitment &", PAGE.margin, 162);
doc.text("Workforce Management Platform", PAGE.margin, 184);

setFillHex(COLORS.ink);
doc.font("Helvetica-Bold").fontSize(20).text("Stakeholder & Sponsor Pitch", PAGE.margin, 290);
setFillHex(COLORS.muted);
doc.font("Helvetica").fontSize(12).text("Modernising government hiring with secure, auditable, AI-assisted workflows", PAGE.margin, 318, { width: CONTENT_W });

// Big stat band
const bandY = 380;
setFillHex(COLORS.bgSoft);
doc.roundedRect(PAGE.margin, bandY, CONTENT_W, 130, 8).fill();
setStrokeHex(COLORS.line);
doc.roundedRect(PAGE.margin, bandY, CONTENT_W, 130, 8).lineWidth(0.5).stroke();

const coverStats = [
  { v: "70%", l: "less manual screening time" },
  { v: "8-step", l: "guided application wizard" },
  { v: "100%", l: "audit-logged decisions" },
];
const colW = (CONTENT_W - 40) / 3;
coverStats.forEach((s, i) => {
  const x = PAGE.margin + 20 + i * colW;
  setFillHex(COLORS.primary);
  doc.font("Helvetica-Bold").fontSize(30).text(s.v, x, bandY + 24, { width: colW - 20, lineBreak: false });
  setFillHex(COLORS.body);
  doc.font("Helvetica").fontSize(10.5).text(s.l, x, bandY + 70, { width: colW - 20 });
});

// Prepared-for block
const prepY = 540;
setFillHex(COLORS.ink);
doc.font("Helvetica-Bold").fontSize(10).text("PREPARED FOR", PAGE.margin, prepY, { characterSpacing: 0.8 });
setFillHex(COLORS.body);
doc.font("Helvetica").fontSize(11).text("Executive sponsors, funding partners, and oversight stakeholders of PNG NISIT", PAGE.margin, prepY + 16);

doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink).text("PREPARED BY", PAGE.margin, prepY + 50, { characterSpacing: 0.8 });
doc.font("Helvetica").fontSize(11).fillColor(COLORS.body).text("PNG NISIT IT Department", PAGE.margin, prepY + 66);

doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink).text("DATE  ·  VERSION", PAGE.margin + 280, prepY, { characterSpacing: 0.8 });
doc.font("Helvetica").fontSize(11).fillColor(COLORS.body).text("April 2026  ·  v1.1 (Single-tenant)", PAGE.margin + 280, prepY + 16);

doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink).text("CLASSIFICATION", PAGE.margin + 280, prepY + 50, { characterSpacing: 0.8 });
doc.font("Helvetica").fontSize(11).fillColor(COLORS.body).text("Confidential — for stakeholder review", PAGE.margin + 280, prepY + 66);

// Bottom band
setFillHex(COLORS.primaryDark);
doc.rect(0, PAGE.height - 36, PAGE.width, 36).fill();
setFillHex("#FFFFFF");
doc.font("Helvetica").fontSize(9).text("PNG NISIT  ·  HR Portal Pitch  ·  April 2026", PAGE.margin, PAGE.height - 24, { width: CONTENT_W, align: "left", lineBreak: false });
doc.text("Confidential", PAGE.margin, PAGE.height - 24, { width: CONTENT_W, align: "right", lineBreak: false });

// ========================================================================
// PAGE 2 — EXECUTIVE SUMMARY
// ========================================================================
doc.addPage();
header();

sectionTitle("01", "Executive Summary");

paragraph(
  "The PNG NISIT HR Portal is a secure, AI-assisted recruitment and workforce-management platform purpose-built for the Papua New Guinea National Institute of Standards and Industrial Technology. It replaces a fragmented, paper-and-spreadsheet hiring process with a single, auditable system that takes a vacancy from public advertisement through to signed employment contract — without ever leaving the platform.",
);

paragraph(
  "Built on modern web technology, deployed in single-tenant mode exclusively for PNG NISIT, and underpinned by government-grade audit logging, the platform is ready today and is already running in production with live job vacancies, applications and employee records.",
);

calloutBox(
  "The opportunity",
  "Government hiring in PNG today is slow, opaque, and difficult to audit. The HR Portal compresses a multi-week recruitment cycle into days, gives leadership real-time visibility into the workforce pipeline, and provides every decision with a defensible audit trail — critical for compliance, anti-corruption posture, and donor reporting.",
  "primary",
);

subsection("What we are asking of stakeholders & sponsors");
bullet("Endorse the HR Portal as PNG NISIT's official recruitment platform of record.");
bullet("Sponsor the next phase: AI model fine-tuning on PNG-specific labour data, expanded analytics, and optional rollout to partner agencies.");
bullet("Champion the platform within whole-of-government digital transformation initiatives.");

// ========================================================================
// PAGE 3 — THE PROBLEM
// ========================================================================
doc.addPage();
header();
sectionTitle("02", "The Problem We Are Solving");

paragraph(
  "Traditional government hiring in Papua New Guinea is a high-friction, low-visibility process. Applications arrive by email, Word document and walk-in. Shortlists are built on spreadsheets. Offer letters are typed by hand and physically signed. Records live in personal inboxes. The result:",
);

bullet("Hiring cycles routinely stretch from weeks to months, and qualified candidates accept offers elsewhere before NISIT can respond.");
bullet("There is no system-of-record. When an auditor, donor or oversight body asks 'why was this candidate hired?', the evidence is scattered across email and filing cabinets.");
bullet("Hiring managers spend hours manually reading CVs, with no consistent ranking, no skills extraction, and no protection against unconscious bias.");
bullet("Workforce planning is reactive — leadership only learns of upcoming vacancies and contract expiries when they arrive.");
bullet("Sensitive data (CVs, salaries, signed contracts) is duplicated across personal devices, creating real privacy and security exposure.");

calloutBox(
  "The cost of doing nothing",
  "Each delayed hire is lost productivity. Each lost audit trail is a compliance and reputational risk. Each manual screening hour is taxpayer money spent on work a computer can do better. The HR Portal addresses all three at the same time.",
  "warn",
);

// ========================================================================
// PAGE 4 — THE SOLUTION
// ========================================================================
doc.addPage();
header();
sectionTitle("03", "The Solution");

paragraph(
  "The HR Portal is an end-to-end recruitment and workforce platform. It covers the full hiring lifecycle — public advertising, application capture, AI-assisted shortlisting, interview workflow, offer-letter generation, contract management, onboarding, and ongoing workforce analytics — in one auditable system.",
);

subsection("Five capability pillars");

bullet("Public career portal & guided 8-step application wizard with auto-save, document upload, and real-time status tracking for applicants.");
bullet("AI-assisted recruitment: automatic CV parsing, candidate ranking against the specific job description, and an interview-question generator tuned to each candidate.");
bullet("End-to-end recruitment workflow: configurable screening questions, auto-reject logic, bulk actions with safety confirmations, and a clear pipeline from Applied → Hired.");
bullet("Branded PDF offer letters and contract management, with one-click email send, resend protection, signed-contract upload, and automated expiry alerts 30 days ahead.");
bullet("Workforce analytics & forecasting, role-based access, fully editable per-role permissions, and government-grade audit logs on every privileged action.");

subsection("Why this design works for PNG NISIT");
paragraph(
  "Single-tenant deployment means all NISIT data is logically and operationally isolated. The underlying multi-tenant architecture is preserved, so if NISIT chooses to extend the platform to partner agencies in the future, that path is one configuration change away — not a re-build.",
);

// ========================================================================
// PAGE 5 — VALUE & IMPACT
// ========================================================================
doc.addPage();
header();
sectionTitle("04", "Value & Measurable Impact");

statTiles([
  { value: "70%", label: "SCREENING TIME SAVED", sub: "AI-assisted CV parsing and ranking eliminate manual sift work." },
  { value: "10×", label: "FASTER OFFER TURNAROUND", sub: "Branded PDF offers generated and emailed in seconds." },
  { value: "100%", label: "AUDIT COVERAGE", sub: "Every decision is logged with actor, target and timestamp." },
]);

subsection("For HR & Hiring Managers");
bullet("AI-ranked shortlists surface the best-fit candidates first, with skills and experience extracted automatically.");
bullet("Bulk actions across server-side filters let one HR officer process hundreds of applications without losing accuracy.");
bullet("Confirmation safeguards on bulk and destructive actions prevent costly mistakes.");

subsection("For Executive Leadership");
bullet("Real-time dashboards show open vacancies, pipeline health, time-to-hire, and stage-duration breakdowns.");
bullet("Workforce forecasting flags upcoming attrition and contract expiries before they become crises.");
bullet("A defensible audit trail is available on demand for oversight, donors, and internal review.");

subsection("For Applicants & the Public");
bullet("Mobile-friendly application wizard with auto-save — applicants do not lose work if they get interrupted.");
bullet("Status notifications at every stage of the pipeline, with one-click unsubscribe support compliant with global email standards.");
bullet("Saved-job closing-soon reminders keep candidates engaged with NISIT vacancies they care about.");

// ========================================================================
// PAGE 6 — DIFFERENTIATORS
// ========================================================================
doc.addPage();
header();
sectionTitle("05", "What Makes This Different");

table(
  [
    ["Capability", "Off-the-shelf HRIS", "Spreadsheets / email", "PNG NISIT HR Portal"],
    ["Built for PNG NISIT branding & process", "Generic", "Manual", "Yes"],
    ["AI candidate ranking against the job", "Limited add-on", "No", "Built-in"],
    ["Government-grade audit trail", "Often opt-in", "No", "On every privileged action"],
    ["Per-role editable permissions matrix", "Rare", "No", "Yes"],
    ["Branded PDF offer letters & contracts", "Add-on", "Hand-typed", "One-click, emailed"],
    ["Workforce forecasting & attrition risk", "Premium tier", "No", "Included"],
    ["Single-tenant data isolation", "Multi-tenant SaaS", "N/A", "Single-tenant for NISIT"],
    ["Future agency expansion path", "Vendor-locked", "N/A", "Architecture-ready"],
  ],
  { widths: [30, 22, 18, 30] },
);

calloutBox(
  "Strategic posture",
  "The HR Portal is not a bought-in SaaS that NISIT must adapt itself to. It is a NISIT-owned platform, with a NISIT-aligned process, NISIT-branded outputs, and a roadmap that NISIT controls.",
  "accent",
);

// ========================================================================
// PAGE 7 — SECURITY, COMPLIANCE & TRUST
// ========================================================================
doc.addPage();
header();
sectionTitle("06", "Security, Compliance & Trust");

subsection("Identity & access");
bullet("Role-based access control with five default roles (System Admin, HR Officer, Hiring Manager, Executive, Applicant).");
bullet("Per-role editable permissions matrix — administrators can tighten or expand access without touching code.");
bullet("Government domain enforcement: staff roles require a verified .gov.pg email; applicants cannot self-elevate.");
bullet("Configurable session timeout (15 min – 4 hr) with automatic idle logout for shared workstations.");

subsection("Data protection");
bullet("Passwords stored as bcrypt hashes; never logged or transmitted in plain text.");
bullet("Document storage isolated by tenant ACL — agency data cannot leak across boundaries.");
bullet("Sensitive document removal requires a written reason and is permanently audit-logged.");
bullet("Email password-reset flow with single-use, expiring tokens.");

subsection("Auditability");
bullet("Every role change, status change, email change, password reset, permissions update, document deletion and offer-letter send is captured in an immutable audit log.");
bullet("Audit log is filterable, exportable, and surfaces actor identity, target, outcome and full context.");
bullet("Designed to satisfy donor reporting, internal audit and anti-corruption oversight requirements.");

// ========================================================================
// PAGE 8 — TECHNOLOGY & DELIVERY
// ========================================================================
doc.addPage();
header();
sectionTitle("07", "Technology & Delivery");

subsection("Modern, maintainable stack");
bullet("React + TypeScript front-end (Vite) — fast, accessible, mobile-friendly.");
bullet("Node.js / Express API server with strict typed contracts (OpenAPI codegen).");
bullet("PostgreSQL with Drizzle ORM — relational integrity, transactional safety.");
bullet("Object storage for CVs, contracts and signed documents, with per-tenant access control.");
bullet("Pino structured logging and a dedicated audit-log subsystem.");
bullet("Email delivery via SMTP with RFC-compliant unsubscribe headers.");

subsection("Operational readiness today");
bullet("Live in production with seeded vacancies, real applicants and real employee records.");
bullet("Automated checkpointing and rollback on every change — zero-downtime recovery from operator error.");
bullet("Hot-reloadable workflows; new features ship without service interruption.");

subsection("Cost profile");
paragraph(
  "Hosted on Replit's managed deployment platform with predictable monthly costs that scale with usage rather than seat count. There is no per-user SaaS licensing tax. The platform is owned by PNG NISIT.",
);

// ========================================================================
// PAGE 9 — ROADMAP
// ========================================================================
doc.addPage();
header();
sectionTitle("08", "Roadmap");

table(
  [
    ["Phase", "Status", "Scope"],
    ["Phase 1 — Foundations", "Delivered", "Single-tenant deployment, full recruitment pipeline, offer letters, contracts, audit log, role-based access, applicant career portal."],
    ["Phase 2 — AI assist", "Delivered", "CV parsing, candidate ranking, interview-question generator, workforce forecasting."],
    ["Phase 3 — Editable governance", "Delivered (Apr 2026)", "Per-role editable permissions matrix, full editable user details, agency reassignment."],
    ["Phase 4 — Sponsor-funded enhancements", "Proposed", "PNG-specific AI model tuning, advanced analytics dashboards, native mobile app for hiring managers, integration with national identity verification."],
    ["Phase 5 — Whole-of-government rollout", "Optional", "Re-enable multi-agency mode for partner agencies; NISIT operates as the platform host & centre of excellence."],
  ],
  { widths: [25, 18, 57] },
);

calloutBox(
  "What sponsorship unlocks",
  "Phase 4 turns a proven NISIT-only platform into a benchmark for PNG public-sector digital transformation. Phase 5 positions NISIT as the operator of a shared service that other agencies pay into — converting an internal tool into a strategic asset.",
  "success",
);

// ========================================================================
// PAGE 10 — RISKS, MITIGATIONS & THE ASK
// ========================================================================
doc.addPage();
header();
sectionTitle("09", "Risks & Mitigations");

table(
  [
    ["Risk", "Mitigation"],
    ["Low user adoption among hiring managers", "Phased rollout with hands-on training; HR officers act as in-house champions; UX already validated against Phase 1 users."],
    ["Data privacy concerns from applicants", "Public-facing privacy notice, single-use reset tokens, audit-logged document removals, RFC-compliant unsubscribe."],
    ["Vendor lock-in fears", "Platform is NISIT-owned; data lives in a NISIT-controlled PostgreSQL database; export tooling available."],
    ["AI mis-ranking of candidates", "AI scores are advisory, not decisive. Hiring decisions remain with humans; every override is logged."],
    ["Funding interruption", "Platform is operational today and self-sustaining at current scope. Sponsorship accelerates Phase 4-5, not Phase 1-3."],
  ],
  { widths: [30, 70] },
);

sectionTitle("10", "The Ask");

paragraph(
  "We are seeking endorsement, sponsorship and advocacy from PNG NISIT's stakeholders to take the HR Portal from a delivered Phase 3 platform to a Phase 4–5 strategic capability.",
);

calloutBox(
  "1.  Endorsement",
  "Formally adopt the HR Portal as PNG NISIT's recruitment platform of record, with executive sign-off for HR, Hiring Managers and Applicants to use it as the single source of truth.",
  "primary",
);
calloutBox(
  "2.  Sponsorship",
  "Co-fund Phase 4: PNG-specific AI tuning, executive analytics, native mobile experience for hiring managers, and integration with national identity & qualification registries.",
  "accent",
);
calloutBox(
  "3.  Advocacy",
  "Champion the platform within wider whole-of-government digital transformation conversations, positioning NISIT as the operator of a future shared HR service for partner agencies.",
  "success",
);

paragraph(" ");
paragraph(
  "We welcome the opportunity to walk stakeholders through a live demonstration of the production system, including the AI ranking pipeline, audit log, editable permissions matrix and offer-letter workflow.",
);

paragraph(" ");
setFillHex(COLORS.ink);
doc.font("Helvetica-Bold").fontSize(11).text("Contact:", { continued: true });
doc.font("Helvetica").text("  PNG NISIT IT Department  ·  HR Portal Programme Office");

// ========================================================================
// FOOTERS
// ========================================================================
const range = doc.bufferedPageRange();
const total = range.count;
for (let i = 0; i < total; i++) {
  doc.switchToPage(i);
  if (i === 0) continue; // skip footer on cover
  footer(i + 1, total);
}

doc.end();
console.log(`PDF written to ${OUT_PATH}`);
