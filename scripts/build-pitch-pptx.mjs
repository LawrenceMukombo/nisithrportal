import PptxGenJS from "pptxgenjs";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const OUT = "docs/PNG_NISIT_HR_Portal_Pitch.pptx";
mkdirSync(dirname(OUT), { recursive: true });

const pres = new PptxGenJS();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
pres.title = "PNG NISIT HR Portal — Stakeholder & Sponsor Pitch";
pres.company = "PNG NISIT";

// Brand palette (aligned to the PDF pitch document)
const PRIMARY = "B22234";
const PRIMARY_DARK = "7A0E1F";
const ACCENT = "0B5394";
const INK = "111827";
const BODY = "374151";
const MUTED = "6B7280";
const LINE = "E5E7EB";
const BG_SOFT = "F9FAFB";
const BG_ACCENT = "FEF2F2";
const GREEN = "15803D";
const AMBER = "B45309";
const WHITE = "FFFFFF";

const W = 13.33;
const H = 7.5;

function chrome(slide, opts = {}) {
  slide.background = { color: WHITE };
  // top band
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.45, fill: { color: PRIMARY } });
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 0.45, w: W, h: 0.05, fill: { color: PRIMARY_DARK } });
  slide.addText("PNG NISIT HR PORTAL", {
    x: 0.4, y: 0.05, w: 8, h: 0.35,
    fontSize: 11, color: WHITE, fontFace: "Calibri", bold: true, charSpacing: 1.5,
  });
  slide.addText("Stakeholder & Sponsor Pitch  ·  April 2026", {
    x: 6.5, y: 0.05, w: 6.5, h: 0.35,
    fontSize: 10, color: WHITE, fontFace: "Calibri", align: "right",
  });
  // bottom footer line
  slide.addShape(pres.ShapeType.line, {
    x: 0.4, y: H - 0.4, w: W - 0.8, h: 0,
    line: { color: LINE, width: 0.5 },
  });
  if (opts.pageNum) {
    slide.addText(`PNG NISIT  ·  HR Portal Pitch  ·  Confidential`, {
      x: 0.4, y: H - 0.32, w: 8, h: 0.25,
      fontSize: 9, color: MUTED, fontFace: "Calibri",
    });
    slide.addText(opts.pageNum, {
      x: W - 1.5, y: H - 0.32, w: 1.1, h: 0.25,
      fontSize: 9, color: MUTED, fontFace: "Calibri", align: "right",
    });
  }
}

function sectionHeader(slide, num, title, subtitle) {
  slide.addShape(pres.ShapeType.rect, {
    x: 0.4, y: 0.85, w: 0.07, h: 0.55, fill: { color: PRIMARY }, line: { color: PRIMARY },
  });
  slide.addText(`${num}.  ${title}`, {
    x: 0.6, y: 0.85, w: W - 1.2, h: 0.55,
    fontSize: 26, bold: true, color: INK, fontFace: "Calibri",
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.6, y: 1.45, w: W - 1.2, h: 0.4,
      fontSize: 13, color: MUTED, fontFace: "Calibri", italic: true,
    });
  }
}

function bullets(slide, items, opts = {}) {
  const x = opts.x ?? 0.6;
  const y = opts.y ?? 2.1;
  const w = opts.w ?? W - 1.2;
  const h = opts.h ?? 4.6;
  const text = items.map((item) => {
    const isStr = typeof item === "string";
    const line = isStr ? item : item.text;
    return {
      text: line,
      options: {
        bullet: { code: "25A0" },
        color: isStr ? BODY : (item.color ?? BODY),
        fontSize: opts.fontSize ?? 15,
        bold: !isStr && item.bold,
        paraSpaceAfter: opts.spaceAfter ?? 8,
      },
    };
  });
  slide.addText(text, { x, y, w, h, fontFace: "Calibri", valign: "top" });
}

function callout(slide, x, y, w, h, label, body, tone = "primary") {
  const palette = {
    primary: { bg: BG_ACCENT, border: PRIMARY, label: PRIMARY_DARK },
    accent: { bg: "EFF6FF", border: ACCENT, label: ACCENT },
    success: { bg: "F0FDF4", border: GREEN, label: GREEN },
    warn: { bg: "FFFBEB", border: AMBER, label: AMBER },
  }[tone];
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: palette.bg },
    line: { color: palette.border, width: 1 },
    rectRadius: 0.08,
  });
  slide.addShape(pres.ShapeType.rect, {
    x, y, w: 0.06, h, fill: { color: palette.border }, line: { color: palette.border },
  });
  let textY = y + 0.12;
  if (label) {
    slide.addText(label.toUpperCase(), {
      x: x + 0.18, y: textY, w: w - 0.3, h: 0.3,
      fontSize: 10, bold: true, color: palette.label, fontFace: "Calibri", charSpacing: 1.2,
    });
    textY += 0.32;
  }
  slide.addText(body, {
    x: x + 0.18, y: textY, w: w - 0.3, h: h - (textY - y) - 0.12,
    fontSize: 13, color: INK, fontFace: "Calibri", valign: "top",
  });
}

function statTile(slide, x, y, w, h, value, label, sub) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: BG_SOFT },
    line: { color: LINE, width: 0.5 },
    rectRadius: 0.08,
  });
  slide.addText(value, {
    x: x + 0.2, y: y + 0.15, w: w - 0.4, h: 0.9,
    fontSize: 40, bold: true, color: PRIMARY, fontFace: "Calibri",
  });
  slide.addText(label, {
    x: x + 0.2, y: y + 1.1, w: w - 0.4, h: 0.35,
    fontSize: 11, bold: true, color: INK, fontFace: "Calibri", charSpacing: 0.6,
  });
  slide.addText(sub, {
    x: x + 0.2, y: y + 1.45, w: w - 0.4, h: h - 1.55,
    fontSize: 10, color: MUTED, fontFace: "Calibri", valign: "top",
  });
}

function dataTable(slide, headers, rows, opts = {}) {
  const x = opts.x ?? 0.6;
  const y = opts.y ?? 2.1;
  const w = opts.w ?? W - 1.2;
  const colWeights = opts.widths ?? headers.map(() => 1);
  const total = colWeights.reduce((a, b) => a + b, 0);
  const colW = colWeights.map((c) => (c / total) * w);

  const headerRow = headers.map((h) => ({
    text: h,
    options: { bold: true, color: WHITE, fill: { color: PRIMARY }, fontSize: 11, valign: "middle" },
  }));
  const bodyRows = rows.map((r, i) => r.map((c) => ({
    text: c,
    options: {
      color: INK,
      fill: { color: i % 2 === 0 ? WHITE : BG_SOFT },
      fontSize: 10.5,
      valign: "middle",
    },
  })));

  slide.addTable([headerRow, ...bodyRows], {
    x, y, w,
    colW,
    border: { type: "solid", color: LINE, pt: 0.5 },
    fontFace: "Calibri",
    rowH: opts.rowH ?? 0.4,
  });
}

// ==========================================================================
// Slide 1 — Cover
// ==========================================================================
{
  const s = pres.addSlide();
  s.background = { color: WHITE };
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: W, h: 3.4, fill: { color: PRIMARY } });
  s.addShape(pres.ShapeType.rect, { x: 0, y: 3.4, w: W, h: 0.18, fill: { color: PRIMARY_DARK } });

  s.addText("PAPUA NEW GUINEA NATIONAL INSTITUTE", {
    x: 0.6, y: 0.7, w: 12, h: 0.35,
    fontSize: 13, color: WHITE, fontFace: "Calibri", bold: true, charSpacing: 1.5,
  });
  s.addText("OF STANDARDS AND INDUSTRIAL TECHNOLOGY", {
    x: 0.6, y: 1.0, w: 12, h: 0.35,
    fontSize: 13, color: WHITE, fontFace: "Calibri", charSpacing: 1.5,
  });

  s.addText("HR Portal", {
    x: 0.6, y: 1.5, w: 12, h: 1.2,
    fontSize: 64, bold: true, color: WHITE, fontFace: "Calibri",
  });
  s.addText("AI-Enabled Recruitment & Workforce Management Platform", {
    x: 0.6, y: 2.7, w: 12, h: 0.5,
    fontSize: 20, color: "FCE7E9", fontFace: "Calibri",
  });

  // Title block
  s.addText("Stakeholder & Sponsor Pitch", {
    x: 0.6, y: 3.85, w: 12, h: 0.6,
    fontSize: 30, bold: true, color: INK, fontFace: "Calibri",
  });
  s.addText("Modernising government hiring with secure, auditable, AI-assisted workflows", {
    x: 0.6, y: 4.4, w: 12, h: 0.4,
    fontSize: 14, color: MUTED, fontFace: "Calibri", italic: true,
  });

  // Stat band
  statTile(s, 0.6, 5.0, 4.0, 1.7, "70%", "LESS SCREENING TIME", "AI-assisted CV parsing & ranking");
  statTile(s, 4.7, 5.0, 4.0, 1.7, "8-step", "GUIDED APPLICATION", "Auto-saving, mobile-friendly wizard");
  statTile(s, 8.8, 5.0, 4.0, 1.7, "100%", "AUDIT COVERAGE", "Every privileged action logged");

  // Footer band
  s.addShape(pres.ShapeType.rect, { x: 0, y: H - 0.5, w: W, h: 0.5, fill: { color: PRIMARY_DARK } });
  s.addText("Prepared by PNG NISIT IT Department  ·  April 2026  ·  v1.1 (Single-tenant)", {
    x: 0.4, y: H - 0.42, w: 8, h: 0.35,
    fontSize: 10, color: WHITE, fontFace: "Calibri",
  });
  s.addText("Confidential", {
    x: W - 4, y: H - 0.42, w: 3.6, h: 0.35,
    fontSize: 10, color: WHITE, fontFace: "Calibri", align: "right", italic: true,
  });
}

// ==========================================================================
// Slide 2 — Agenda
// ==========================================================================
{
  const s = pres.addSlide();
  chrome(s, { pageNum: "2 / 13" });
  sectionHeader(s, "00", "Agenda", "What we will cover today");

  const items = [
    "01.  Executive Summary",
    "02.  The Problem We Are Solving",
    "03.  The Solution",
    "04.  Value & Measurable Impact",
    "05.  What Makes This Different",
    "06.  Security, Compliance & Trust",
    "07.  Technology & Delivery",
    "08.  Roadmap",
    "09.  Risks & Mitigations",
    "10.  The Ask",
  ];
  s.addText(
    items.map((t, i) => ({
      text: t,
      options: {
        color: i % 2 === 0 ? INK : BODY,
        fontSize: 17,
        bold: i % 2 === 0,
        paraSpaceAfter: 10,
      },
    })),
    { x: 1.0, y: 2.1, w: 11, h: 4.8, fontFace: "Calibri", valign: "top" },
  );
}

// ==========================================================================
// Slide 3 — Executive Summary
// ==========================================================================
{
  const s = pres.addSlide();
  chrome(s, { pageNum: "3 / 13" });
  sectionHeader(s, "01", "Executive Summary");

  s.addText(
    "The PNG NISIT HR Portal is a secure, AI-assisted recruitment and workforce-management platform purpose-built for the Papua New Guinea National Institute of Standards and Industrial Technology. It replaces a fragmented, paper-and-spreadsheet hiring process with a single, auditable system that takes a vacancy from public advertisement through to signed employment contract — without ever leaving the platform.",
    { x: 0.6, y: 2.0, w: W - 1.2, h: 1.6, fontSize: 13, color: BODY, fontFace: "Calibri", paraSpaceAfter: 6 },
  );

  callout(
    s, 0.6, 3.7, W - 1.2, 1.5,
    "The Opportunity",
    "Government hiring in PNG today is slow, opaque, and difficult to audit. The HR Portal compresses a multi-week recruitment cycle into days, gives leadership real-time visibility into the workforce pipeline, and provides every decision with a defensible audit trail.",
    "primary",
  );

  s.addText("What we are asking of stakeholders & sponsors", {
    x: 0.6, y: 5.4, w: W - 1.2, h: 0.4,
    fontSize: 14, bold: true, color: ACCENT, fontFace: "Calibri",
  });
  bullets(s, [
    "Endorse the HR Portal as PNG NISIT's official recruitment platform of record",
    "Sponsor Phase 4: PNG-specific AI tuning, executive analytics, native mobile experience",
    "Champion the platform within whole-of-government digital transformation initiatives",
  ], { y: 5.85, h: 1.4, fontSize: 13, spaceAfter: 4 });
}

// ==========================================================================
// Slide 4 — The Problem
// ==========================================================================
{
  const s = pres.addSlide();
  chrome(s, { pageNum: "4 / 13" });
  sectionHeader(s, "02", "The Problem We Are Solving", "Today's hiring process is slow, opaque, and hard to defend");

  bullets(s, [
    "Hiring cycles stretch from weeks to months — qualified candidates accept offers elsewhere first",
    "No system-of-record: when oversight bodies ask 'why was this candidate hired?', evidence is scattered",
    "Hiring managers spend hours manually reading CVs with no consistent ranking and no bias protection",
    "Workforce planning is reactive — leadership only learns of vacancies and contract expiries when they arrive",
    "Sensitive data (CVs, salaries, contracts) is duplicated across personal devices, creating real exposure",
  ], { y: 2.0, h: 3.5 });

  callout(
    s, 0.6, 5.7, W - 1.2, 1.4,
    "The Cost of Doing Nothing",
    "Each delayed hire is lost productivity. Each lost audit trail is a compliance and reputational risk. Each manual screening hour is taxpayer money spent on work a computer can do better.",
    "warn",
  );
}

// ==========================================================================
// Slide 5 — The Solution
// ==========================================================================
{
  const s = pres.addSlide();
  chrome(s, { pageNum: "5 / 13" });
  sectionHeader(s, "03", "The Solution", "End-to-end recruitment and workforce management in one auditable system");

  s.addText("Five capability pillars", {
    x: 0.6, y: 2.0, w: W - 1.2, h: 0.35,
    fontSize: 13, bold: true, color: ACCENT, fontFace: "Calibri",
  });
  bullets(s, [
    "Public career portal & guided 8-step application wizard with auto-save and live status tracking",
    "AI-assisted recruitment: automatic CV parsing, candidate ranking, and tailored interview-question generation",
    "End-to-end workflow: configurable screening questions, auto-reject, bulk actions, clear pipeline from Applied → Hired",
    "Branded PDF offer letters and contract management with one-click email send and 30-day expiry alerts",
    "Workforce analytics & forecasting, role-based access, fully editable per-role permissions, and government-grade audit logs",
  ], { y: 2.45, h: 3.6, fontSize: 14 });

  callout(
    s, 0.6, 6.15, W - 1.2, 1.0,
    "Why this design fits NISIT",
    "Single-tenant deployment isolates all NISIT data. The underlying multi-tenant architecture is preserved — extending to partner agencies later is a configuration change, not a re-build.",
    "accent",
  );
}

// ==========================================================================
// Slide 6 — Value & Impact
// ==========================================================================
{
  const s = pres.addSlide();
  chrome(s, { pageNum: "6 / 13" });
  sectionHeader(s, "04", "Value & Measurable Impact");

  statTile(s, 0.6, 1.95, 4.0, 1.6, "70%", "SCREENING TIME SAVED", "AI-assisted CV parsing & ranking");
  statTile(s, 4.7, 1.95, 4.0, 1.6, "10×", "FASTER OFFER TURNAROUND", "Branded PDF offers in seconds");
  statTile(s, 8.8, 1.95, 4.0, 1.6, "100%", "AUDIT COVERAGE", "Actor, target, timestamp on every action");

  // Three-column benefits
  const colY = 3.85;
  const colH = 3.0;
  const colW = 4.0;
  const titles = ["For HR & Hiring Managers", "For Executive Leadership", "For Applicants & the Public"];
  const lists = [
    [
      "AI-ranked shortlists surface best-fit first",
      "Bulk actions across server-side filters",
      "Confirmation safeguards on destructive actions",
    ],
    [
      "Real-time vacancy & pipeline dashboards",
      "Workforce forecasting flags upcoming attrition",
      "Defensible audit trail on demand",
    ],
    [
      "Mobile-friendly wizard with auto-save",
      "Status notifications at every stage",
      "Saved-job closing-soon reminders",
    ],
  ];
  for (let i = 0; i < 3; i++) {
    const x = 0.6 + i * (colW + 0.1);
    s.addShape(pres.ShapeType.roundRect, {
      x, y: colY, w: colW, h: colH,
      fill: { color: WHITE }, line: { color: LINE, width: 0.5 }, rectRadius: 0.06,
    });
    s.addShape(pres.ShapeType.rect, {
      x, y: colY, w: colW, h: 0.08, fill: { color: PRIMARY }, line: { color: PRIMARY },
    });
    s.addText(titles[i], {
      x: x + 0.2, y: colY + 0.2, w: colW - 0.4, h: 0.4,
      fontSize: 13, bold: true, color: ACCENT, fontFace: "Calibri",
    });
    s.addText(
      lists[i].map((t) => ({
        text: t,
        options: { bullet: { code: "25A0" }, color: BODY, fontSize: 11.5, paraSpaceAfter: 6 },
      })),
      { x: x + 0.2, y: colY + 0.7, w: colW - 0.4, h: colH - 0.9, fontFace: "Calibri", valign: "top" },
    );
  }
}

// ==========================================================================
// Slide 7 — What Makes This Different (table)
// ==========================================================================
{
  const s = pres.addSlide();
  chrome(s, { pageNum: "7 / 13" });
  sectionHeader(s, "05", "What Makes This Different");

  dataTable(
    s,
    ["Capability", "Off-the-shelf HRIS", "Spreadsheets / email", "PNG NISIT HR Portal"],
    [
      ["Built for PNG NISIT branding & process", "Generic", "Manual", "Yes"],
      ["AI candidate ranking against the job", "Limited add-on", "No", "Built-in"],
      ["Government-grade audit trail", "Often opt-in", "No", "Every privileged action"],
      ["Per-role editable permissions matrix", "Rare", "No", "Yes"],
      ["Branded PDF offer letters & contracts", "Add-on", "Hand-typed", "One-click, emailed"],
      ["Workforce forecasting", "Premium tier", "No", "Included"],
      ["Single-tenant data isolation", "Multi-tenant SaaS", "N/A", "Single-tenant for NISIT"],
    ],
    { y: 2.0, widths: [3.2, 2.2, 1.8, 3.0], rowH: 0.42 },
  );

  callout(
    s, 0.6, 6.4, W - 1.2, 0.85,
    "Strategic Posture",
    "The HR Portal is not bought-in SaaS NISIT must adapt itself to. It is a NISIT-owned platform, with NISIT-aligned process, NISIT-branded outputs, and a NISIT-controlled roadmap.",
    "accent",
  );
}

// ==========================================================================
// Slide 8 — Security & Compliance
// ==========================================================================
{
  const s = pres.addSlide();
  chrome(s, { pageNum: "8 / 13" });
  sectionHeader(s, "06", "Security, Compliance & Trust");

  // Three columns
  const titles = ["Identity & Access", "Data Protection", "Auditability"];
  const lists = [
    [
      "Role-based access (5 default roles)",
      "Per-role editable permissions matrix",
      "Government domain enforcement (.gov.pg)",
      "Configurable session timeout, idle logout",
    ],
    [
      "bcrypt password hashing",
      "Tenant-isolated document storage",
      "Reason-tracked sensitive removals",
      "Single-use, expiring reset tokens",
    ],
    [
      "Immutable audit log on every privileged action",
      "Filterable, exportable audit history",
      "Actor / target / outcome on every entry",
      "Built for donor & oversight reporting",
    ],
  ];
  const colW = 4.0;
  for (let i = 0; i < 3; i++) {
    const x = 0.6 + i * (colW + 0.1);
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 2.0, w: colW, h: 4.8,
      fill: { color: BG_SOFT }, line: { color: LINE, width: 0.5 }, rectRadius: 0.08,
    });
    s.addShape(pres.ShapeType.rect, {
      x, y: 2.0, w: 0.07, h: 4.8, fill: { color: PRIMARY }, line: { color: PRIMARY },
    });
    s.addText(titles[i], {
      x: x + 0.25, y: 2.15, w: colW - 0.4, h: 0.45,
      fontSize: 14, bold: true, color: INK, fontFace: "Calibri",
    });
    s.addText(
      lists[i].map((t) => ({
        text: t,
        options: { bullet: { code: "25A0" }, color: BODY, fontSize: 12, paraSpaceAfter: 8 },
      })),
      { x: x + 0.25, y: 2.7, w: colW - 0.4, h: 4.0, fontFace: "Calibri", valign: "top" },
    );
  }
}

// ==========================================================================
// Slide 9 — Technology & Delivery
// ==========================================================================
{
  const s = pres.addSlide();
  chrome(s, { pageNum: "9 / 13" });
  sectionHeader(s, "07", "Technology & Delivery");

  s.addText("Modern, maintainable stack", {
    x: 0.6, y: 2.0, w: 6.0, h: 0.4,
    fontSize: 14, bold: true, color: ACCENT, fontFace: "Calibri",
  });
  bullets(s, [
    "React + TypeScript front-end (Vite)",
    "Node.js / Express API with typed OpenAPI codegen",
    "PostgreSQL + Drizzle ORM",
    "Object storage with per-tenant ACLs",
    "Pino structured logging + audit subsystem",
    "SMTP email with RFC-compliant unsubscribe",
  ], { x: 0.6, y: 2.45, w: 6.0, h: 4.0, fontSize: 13, spaceAfter: 8 });

  s.addText("Operational readiness today", {
    x: 7.0, y: 2.0, w: 5.7, h: 0.4,
    fontSize: 14, bold: true, color: ACCENT, fontFace: "Calibri",
  });
  bullets(s, [
    "Live in production with real users & data",
    "Automated checkpoints & rollback",
    "Hot-reloadable workflows, zero-downtime",
    "No per-user SaaS licensing — NISIT-owned",
    "Predictable, usage-scaled hosting cost",
  ], { x: 7.0, y: 2.45, w: 5.7, h: 4.0, fontSize: 13, spaceAfter: 8 });
}

// ==========================================================================
// Slide 10 — Roadmap (table)
// ==========================================================================
{
  const s = pres.addSlide();
  chrome(s, { pageNum: "10 / 13" });
  sectionHeader(s, "08", "Roadmap");

  dataTable(
    s,
    ["Phase", "Status", "Scope"],
    [
      ["Phase 1 — Foundations", "Delivered", "Single-tenant deployment, full pipeline, offer letters, contracts, audit log, RBAC, applicant portal"],
      ["Phase 2 — AI assist", "Delivered", "CV parsing, candidate ranking, interview-question generator, workforce forecasting"],
      ["Phase 3 — Editable governance", "Delivered (Apr 2026)", "Per-role editable permissions matrix, full editable user details, agency reassignment"],
      ["Phase 4 — Sponsor-funded", "Proposed", "PNG-specific AI tuning, advanced analytics, native mobile, national identity integration"],
      ["Phase 5 — Whole-of-government", "Optional", "Re-enable multi-agency mode; NISIT operates a shared HR service for partner agencies"],
    ],
    { y: 2.0, widths: [2.6, 2.0, 6.4], rowH: 0.55 },
  );

  callout(
    s, 0.6, 5.85, W - 1.2, 1.3,
    "What sponsorship unlocks",
    "Phase 4 turns a proven NISIT-only platform into a benchmark for PNG public-sector digital transformation. Phase 5 positions NISIT as the operator of a shared service that other agencies pay into — converting an internal tool into a strategic asset.",
    "success",
  );
}

// ==========================================================================
// Slide 11 — Risks & Mitigations (table)
// ==========================================================================
{
  const s = pres.addSlide();
  chrome(s, { pageNum: "11 / 13" });
  sectionHeader(s, "09", "Risks & Mitigations");

  dataTable(
    s,
    ["Risk", "Mitigation"],
    [
      ["Low user adoption among hiring managers", "Phased rollout with hands-on training; HR officers as in-house champions; UX validated in Phase 1"],
      ["Applicant data privacy concerns", "Public privacy notice, single-use reset tokens, audit-logged removals, RFC-compliant unsubscribe"],
      ["Vendor lock-in fears", "Platform is NISIT-owned; data lives in NISIT-controlled PostgreSQL; export tooling available"],
      ["AI mis-ranking of candidates", "AI scores are advisory, not decisive. Humans decide; every override is logged"],
      ["Funding interruption", "Platform is operational and self-sustaining at current scope. Sponsorship accelerates Phase 4-5"],
    ],
    { y: 2.0, widths: [3.4, 8.2], rowH: 0.7 },
  );
}

// ==========================================================================
// Slide 12 — The Ask
// ==========================================================================
{
  const s = pres.addSlide();
  chrome(s, { pageNum: "12 / 13" });
  sectionHeader(s, "10", "The Ask", "From a delivered Phase 3 platform to a Phase 4–5 strategic capability");

  callout(
    s, 0.6, 2.2, W - 1.2, 1.35,
    "1.  Endorsement",
    "Formally adopt the HR Portal as PNG NISIT's recruitment platform of record, with executive sign-off for HR, Hiring Managers and Applicants to use it as the single source of truth.",
    "primary",
  );
  callout(
    s, 0.6, 3.75, W - 1.2, 1.35,
    "2.  Sponsorship",
    "Co-fund Phase 4: PNG-specific AI tuning, executive analytics, native mobile experience for hiring managers, and integration with national identity & qualification registries.",
    "accent",
  );
  callout(
    s, 0.6, 5.3, W - 1.2, 1.35,
    "3.  Advocacy",
    "Champion the platform within whole-of-government digital transformation conversations, positioning NISIT as the operator of a future shared HR service for partner agencies.",
    "success",
  );
}

// ==========================================================================
// Slide 13 — Closer / Contact
// ==========================================================================
{
  const s = pres.addSlide();
  s.background = { color: PRIMARY };
  s.addShape(pres.ShapeType.rect, { x: 0, y: H - 0.55, w: W, h: 0.55, fill: { color: PRIMARY_DARK } });

  s.addText("Thank You", {
    x: 0.6, y: 1.8, w: 12, h: 1.3,
    fontSize: 64, bold: true, color: WHITE, fontFace: "Calibri",
  });
  s.addText("We welcome the opportunity to walk stakeholders through a live demonstration of the production system —", {
    x: 0.6, y: 3.2, w: 12, h: 0.5,
    fontSize: 16, color: "FCE7E9", fontFace: "Calibri",
  });
  s.addText("AI ranking, audit log, editable permissions matrix, and the offer-letter workflow.", {
    x: 0.6, y: 3.6, w: 12, h: 0.5,
    fontSize: 16, color: "FCE7E9", fontFace: "Calibri",
  });

  s.addShape(pres.ShapeType.line, {
    x: 0.6, y: 4.6, w: 4.0, h: 0,
    line: { color: WHITE, width: 1.5 },
  });
  s.addText("CONTACT", {
    x: 0.6, y: 4.8, w: 6, h: 0.35,
    fontSize: 12, bold: true, color: WHITE, fontFace: "Calibri", charSpacing: 2,
  });
  s.addText("PNG NISIT IT Department", {
    x: 0.6, y: 5.15, w: 8, h: 0.4,
    fontSize: 18, bold: true, color: WHITE, fontFace: "Calibri",
  });
  s.addText("HR Portal Programme Office", {
    x: 0.6, y: 5.55, w: 8, h: 0.4,
    fontSize: 14, color: "FCE7E9", fontFace: "Calibri", italic: true,
  });

  s.addText("PNG NISIT  ·  HR Portal Pitch  ·  April 2026  ·  Confidential", {
    x: 0.4, y: H - 0.45, w: W - 0.8, h: 0.35,
    fontSize: 10, color: WHITE, fontFace: "Calibri", align: "center",
  });
}

await pres.writeFile({ fileName: OUT });
console.log(`PPTX written to ${OUT}`);
