import { Router, type IRouter, type Request, type Response } from "express";
import { eq, desc } from "drizzle-orm";
import {
  db,
  applicationsTable,
  candidatesTable,
  jobsTable,
  contractsTable,
  employeesTable,
  positionsTable,
  agenciesTable,
  departmentsTable,
  offerLetterSendLogTable,
  usersTable,
} from "@workspace/db";
import { authMiddleware, requireRole, parseIntParam } from "../middlewares/auth";
import { getTenantAgencyId, assertTenantAccess } from "../middlewares/tenant";
import PDFDocument from "pdfkit";
import { sendOfferLetterEmail } from "../lib/email";
import { logger } from "../lib/logger";
import { createNotification, getUserIdByEmail, notifyAdmins } from "../lib/notificationService";
import nisitLogoDataUrl from "../assets/nisit-logo.png";

const router: IRouter = Router();

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d?: string | Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PG", { day: "numeric", month: "long", year: "numeric" });
}

function fmtSalary(min?: number | null, max?: number | null, currency?: string | null): string {
  const c = currency ?? "PGK";
  if (min && max) return `${c} ${min.toLocaleString()} – ${c} ${max.toLocaleString()} per annum`;
  if (min) return `${c} ${min.toLocaleString()} per annum`;
  if (max) return `${c} ${max.toLocaleString()} per annum`;
  return "As per government salary schedule";
}

const NISIT_COLOR = "#003082";   // PNG government deep blue
const LINE_COLOR = "#c0a030";    // gold accent

let _logoBuffer: Buffer | null = null;
function getLogoBuffer(): Buffer | null {
  if (_logoBuffer !== null) return _logoBuffer;
  try {
    const b64 = nisitLogoDataUrl.replace(/^data:image\/[a-z]+;base64,/, "");
    _logoBuffer = Buffer.from(b64, "base64");
    return _logoBuffer;
  } catch (err) {
    console.warn("[pdf] NISIT logo could not be decoded — documents will be generated without logo branding:", err);
    return null;
  }
}

function drawLetterhead(doc: PDFKit.PDFDocument, agencyName: string) {
  const pageWidth = doc.page.width;
  const margins = 72;

  // Gold top bar
  doc.rect(0, 0, pageWidth, 8).fill(LINE_COLOR);

  // Blue header block — slightly taller to accommodate logo
  doc.rect(0, 8, pageWidth, 84).fill(NISIT_COLOR);

  // Try to embed NISIT logo on the left
  const logo = getLogoBuffer();
  if (logo) {
    try {
      doc.image(logo, margins, 14, { height: 60, fit: [80, 60] });
    } catch (err) {
      console.warn("[pdf] Failed to render NISIT logo in PDF letterhead — document will be generated without logo:", err);
    }
  }

  // Organization name in white — centred in the remaining space
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(13)
    .text("GOVERNMENT OF PAPUA NEW GUINEA", margins + 90, 22, { align: "center", width: pageWidth - margins - 90 - margins });

  doc.fontSize(10).font("Helvetica")
    .text(agencyName.toUpperCase(), margins + 90, 42, { align: "center", width: pageWidth - margins - 90 - margins });

  doc.fontSize(8).font("Helvetica").fillColor("#d4c87a")
    .text("PNG NATIONAL INFORMATION & COMMUNICATIONS TECHNOLOGY INSTITUTE", margins + 90, 60, { align: "center", width: pageWidth - margins - 90 - margins });

  // Gold bottom bar of header
  doc.rect(0, 92, pageWidth, 4).fill(LINE_COLOR);

  // Generated-on date stamp
  const generatedOn = new Date().toLocaleDateString("en-PG", { day: "numeric", month: "long", year: "numeric" });
  doc.fillColor("#555555").font("Helvetica").fontSize(8)
    .text(`Generated on: ${generatedOn}`, margins, 102, { align: "right", width: pageWidth - margins * 2 });

  doc.fillColor("#000000").moveDown(0);
}

function sectionLabel(doc: PDFKit.PDFDocument, label: string) {
  doc.fontSize(9).font("Helvetica-Bold").fillColor(NISIT_COLOR).text(label.toUpperCase());
  doc.moveDown(0.2);
}

function bodyText(doc: PDFKit.PDFDocument, text: string) {
  doc.fontSize(10).font("Helvetica").fillColor("#000000").text(text, { lineGap: 2 });
  doc.moveDown(0.5);
}

function divider(doc: PDFKit.PDFDocument) {
  doc.strokeColor(LINE_COLOR).moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .lineWidth(0.5).stroke();
  doc.moveDown(0.5);
}

function fieldRow(doc: PDFKit.PDFDocument, label: string, value: string) {
  const startX = doc.page.margins.left;
  const labelWidth = 170;
  const y = doc.y;
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#555555").text(label + ":", startX, y, { width: labelWidth, continued: false });
  doc.fontSize(9).font("Helvetica").fillColor("#000000").text(value, startX + labelWidth, y, { width: doc.page.width - startX - labelWidth - doc.page.margins.right });
  doc.moveDown(0.3);
}

const drawingFooterFor = new WeakSet<PDFKit.PDFDocument>();

function drawFooter(doc: PDFKit.PDFDocument, agencyName: string, refNo: string, label: string) {
  if (drawingFooterFor.has(doc)) return;
  drawingFooterFor.add(doc);
  const prevX = doc.x;
  const prevY = doc.y;
  const prevBottomMargin = doc.page.margins.bottom;
  try {
    const footerY = doc.page.height - 40;
    const generatedOn = new Date().toLocaleDateString("en-PG", { day: "numeric", month: "long", year: "numeric" });
    // Temporarily clear the bottom margin so pdfkit does not auto-add a new
    // page when we draw text below the normal text area. Combined with
    // lineBreak:false and height:0 this guarantees the footer text never
    // triggers a `pageAdded` event, which previously caused infinite recursion.
    doc.page.margins.bottom = 0;
    doc.save();
    try {
      doc.fontSize(7).fillColor("#888888").font("Helvetica")
        .text(
          `${agencyName} · ${label} · ${refNo} · Generated on: ${generatedOn}`,
          0,
          footerY,
          { align: "center", width: doc.page.width, lineBreak: false, height: 0 },
        );
    } finally {
      doc.restore();
    }
  } finally {
    doc.page.margins.bottom = prevBottomMargin;
    doc.x = prevX;
    doc.y = prevY;
    drawingFooterFor.delete(doc);
  }
}

function attachFooterToAllPages(doc: PDFKit.PDFDocument, agencyName: string, refNo: string, label: string) {
  doc.on("pageAdded", () => drawFooter(doc, agencyName, refNo, label));
  drawFooter(doc, agencyName, refNo, label);
}

function drawOfficialStamp(doc: PDFKit.PDFDocument, x: number, y: number, refNo: string, dateStr: string) {
  doc.save();
  try {
    // Outer red dashed border
    doc.lineWidth(1.5).strokeColor("#991b1b").rect(x, y, 170, 78).dash(4, { space: 2 }).stroke();
    doc.undash();

    // Inner background tint
    doc.rect(x + 1, y + 1, 168, 76).fillOpacity(0.04).fill("#991b1b");
    doc.fillOpacity(1);

    // Header badge
    doc.fontSize(7).font("Helvetica-Bold").fillColor("#991b1b")
      .text("GOVERNMENT OF PAPUA NEW GUINEA", x, y + 6, { width: 170, align: "center" });

    doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#002b66")
      .text("NISIT STATUTORY SEAL", x, y + 18, { width: 170, align: "center" });

    doc.fontSize(7).font("Helvetica-Bold").fillColor("#c0a030")
      .text("★ OFFICIALLY VERIFIED & AUTHENTICATED ★", x, y + 31, { width: 170, align: "center" });

    // Divider line
    doc.strokeColor("#991b1b").lineWidth(0.5).moveTo(x + 10, y + 43).lineTo(x + 160, y + 43).stroke();

    doc.fontSize(6.5).font("Helvetica").fillColor("#333333")
      .text(`Certified On: ${dateStr}`, x, y + 48, { width: 170, align: "center" });

    doc.fontSize(6).font("Helvetica-Bold").fillColor("#666666")
      .text(`Security Ref: ${refNo}`, x, y + 59, { width: 170, align: "center" });
  } finally {
    doc.restore();
  }
}

function signatureBlock(doc: PDFKit.PDFDocument, refNo: string = `NISIT/HR/${new Date().getFullYear()}`, dateStr: string = fmtDate(new Date())) {
  doc.moveDown(1.5);
  const x = doc.page.margins.left;
  const currentY = doc.y;

  doc.fontSize(10).font("Helvetica").fillColor("#000000");
  doc.text("Yours sincerely,", x, currentY);

  const signLineY = currentY + 45;
  doc.strokeColor("#000000").moveTo(x, signLineY).lineTo(x + 200, signLineY).lineWidth(0.8).stroke();
  doc.fontSize(9).font("Helvetica-Bold").text("Authorised Officer", x, signLineY + 5);
  doc.font("Helvetica").fontSize(8.5).text("Corporate Services & Human Resources", x, signLineY + 18);
  doc.text("PNG National Institute of Standards and Industrial Technology (NISIT)", x, signLineY + 30);
  doc.font("Helvetica-Bold").text(`Date: ${dateStr}`, x, signLineY + 44);

  // Render official stamp on the right side
  const stampX = doc.page.width - doc.page.margins.right - 170;
  drawOfficialStamp(doc, stampX, currentY + 10, refNo, dateStr);

  doc.y = signLineY + 60;
}

// ─── GET /api/pdf/offer-letter/:applicationId ────────────────────────────────

router.get(
  "/pdf/offer-letter/:applicationId",
  authMiddleware,
  requireRole("admin", "hr_officer", "hiring_manager"),
  async (req: Request, res: Response) => {
    const applicationId = parseIntParam(req.params.applicationId);

    const [appRow] = await db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, applicationId));

    if (!appRow) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    if (appRow.status !== "hired") {
      res.status(400).json({ error: "Offer letters can only be generated for hired applications" });
      return;
    }

    // Tenant access: derive the job's agency and assert the requesting user belongs to it
    const [jobForTenant] = await db.select({ agencyId: jobsTable.agencyId }).from(jobsTable).where(eq(jobsTable.id, appRow.jobId));
    if (!assertTenantAccess(res, jobForTenant?.agencyId ?? null, getTenantAgencyId(req))) return;

    const [candidate] = await db
      .select()
      .from(candidatesTable)
      .where(eq(candidatesTable.id, appRow.candidateId!));

    const [job] = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, appRow.jobId));

    const agencyId = job?.agencyId ?? req.user?.agencyId;
    const [agency] = agencyId
      ? await db.select().from(agenciesTable).where(eq(agenciesTable.id, agencyId))
      : [];

    const [department] = job?.departmentId
      ? await db.select().from(departmentsTable).where(eq(departmentsTable.id, job.departmentId))
      : [];

    const agencyName = agency?.name ?? "PNG National Information & Communications Technology Institute (NISIT)";
    const candidateName = candidate?.name ?? "Candidate";
    const position = job?.title ?? "Position";
    const refNo = `NISIT/HR/OL/${new Date().getFullYear()}/${String(applicationId).padStart(4, "0")}`;

    const doc = new PDFDocument({ size: "A4", margins: { top: 100, bottom: 60, left: 72, right: 72 }, compress: true });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="offer-letter-${applicationId}.pdf"`);
    doc.pipe(res);

    attachFooterToAllPages(doc, agencyName, refNo, "Official Document");
    drawLetterhead(doc, agencyName);
    doc.moveDown(1.2);

    // Reference & date
    const mx = doc.page.margins.left;
    doc.fontSize(9).font("Helvetica").fillColor("#555555").text(`Ref: ${refNo}`, mx);
    doc.text(`Date: ${fmtDate(new Date())}`, mx);
    doc.moveDown(1);

    // Recipient
    sectionLabel(doc, "Recipient");
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#000000").text(candidateName, mx);
    if (candidate?.physicalAddress) doc.font("Helvetica").fontSize(10).text(candidate.physicalAddress, mx);
    if (candidate?.city) doc.fontSize(10).text(`${candidate.city}${candidate?.province ? ", " + candidate.province : ""}`, mx);
    doc.moveDown(1);

    divider(doc);

    // Subject
    doc.fontSize(11).font("Helvetica-Bold").fillColor(NISIT_COLOR)
      .text(`SUBJECT: LETTER OF OFFER — ${position.toUpperCase()}`, mx);
    doc.moveDown(0.8);
    divider(doc);

    // Salutation & opening
    bodyText(doc, `Dear ${candidateName},`);
    bodyText(doc,
      `On behalf of ${agencyName}, I am pleased to inform you that following a rigorous recruitment ` +
      `and selection process, the Selection Committee has recommended your appointment to the position ` +
      `of ${position}. This letter formally offers you employment subject to the terms and conditions set out below.`
    );

    // Terms
    sectionLabel(doc, "1. Position Details");
    fieldRow(doc, "Position Title", position);
    fieldRow(doc, "Department / Division", department?.name ?? "As notified");
    fieldRow(doc, "Grade / Band", job?.gradeBand ?? "As per government salary schedule");
    fieldRow(doc, "Employment Type", job?.employmentType ? job.employmentType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "As specified in contract");
    doc.moveDown(0.5);

    sectionLabel(doc, "2. Remuneration");
    fieldRow(doc, "Annual Salary Range", fmtSalary(job?.salaryMin, job?.salaryMax, job?.salaryCurrency));
    fieldRow(doc, "Agreed / Expected Salary", appRow.expectedSalary ? `${job?.salaryCurrency ?? "PGK"} ${appRow.expectedSalary} per annum` : "As per grade schedule");
    doc.moveDown(0.5);

    sectionLabel(doc, "3. Conditions of Employment");
    bodyText(doc,
      `Your appointment is subject to satisfactory completion of background checks, reference verification, ` +
      `and medical fitness clearance. The appointment will be governed by the Public Services ` +
      `(Management) Act 2014 and the relevant Enterprise Agreement currently in force.`
    );

    sectionLabel(doc, "4. Acceptance");
    bodyText(doc,
      `Please indicate your acceptance of this offer by signing and returning a copy of this letter ` +
      `within seven (7) working days of the date above. Failure to do so may result in this offer being ` +
      `withdrawn.`
    );

    bodyText(doc,
      `We look forward to welcoming you to the ${agencyName} team. Should you have any queries, ` +
      `please do not hesitate to contact the Human Resources Division.`
    );

    divider(doc);

    // Signature
    signatureBlock(doc);

    doc.end();
  }
);

// ─── POST /api/pdf/send-offer-letter/:applicationId ─────────────────────────
// Generates the offer-letter PDF and emails it to the candidate

router.post(
  "/pdf/send-offer-letter/:applicationId",
  authMiddleware,
  requireRole("admin", "hr_officer", "hiring_manager"),
  async (req: Request, res: Response) => {
    const applicationId = parseIntParam(req.params.applicationId);

    const [appRow] = await db
      .select()
      .from(applicationsTable)
      .where(eq(applicationsTable.id, applicationId));

    if (!appRow) { res.status(404).json({ error: "Application not found" }); return; }
    if (appRow.status !== "hired") { res.status(400).json({ error: "Offer letters can only be sent for hired applications" }); return; }

    const [jobForTenant] = await db.select({ agencyId: jobsTable.agencyId }).from(jobsTable).where(eq(jobsTable.id, appRow.jobId));
    if (!assertTenantAccess(res, jobForTenant?.agencyId ?? null, getTenantAgencyId(req))) return;

    const [candidate] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, appRow.candidateId!));
    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, appRow.jobId));

    const candidateEmail = candidate?.email;
    if (!candidateEmail) { res.status(400).json({ error: "Candidate has no email address on file" }); return; }

    const agencyId = job?.agencyId ?? req.user?.agencyId;
    const [agency] = agencyId ? await db.select().from(agenciesTable).where(eq(agenciesTable.id, agencyId)) : [];
    const [department] = job?.departmentId ? await db.select().from(departmentsTable).where(eq(departmentsTable.id, job.departmentId)) : [];

    const agencyName = agency?.name ?? "PNG National Information & Communications Technology Institute (NISIT)";
    const candidateName = candidate?.name ?? "Candidate";
    const position = job?.title ?? "Position";
    const refNo = `NISIT/HR/OL/${new Date().getFullYear()}/${String(applicationId).padStart(4, "0")}`;

    // Generate PDF to buffer
    const doc = new PDFDocument({ size: "A4", margins: { top: 100, bottom: 60, left: 72, right: 72 }, compress: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    await new Promise<void>((resolve, reject) => {
      doc.on("end", resolve);
      doc.on("error", reject);

      attachFooterToAllPages(doc, agencyName, refNo, "Official Document");
      drawLetterhead(doc, agencyName);
      doc.moveDown(1.2);
      const mx = doc.page.margins.left;
      doc.fontSize(9).font("Helvetica").fillColor("#555555").text(`Ref: ${refNo}`, mx);
      doc.text(`Date: ${fmtDate(new Date())}`, mx);
      doc.moveDown(1);
      sectionLabel(doc, "Recipient");
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#000000").text(candidateName, mx);
      if (candidate?.physicalAddress) doc.font("Helvetica").fontSize(10).text(candidate.physicalAddress, mx);
      if (candidate?.city) doc.fontSize(10).text(`${candidate.city}${candidate?.province ? ", " + candidate.province : ""}`, mx);
      doc.moveDown(1);
      divider(doc);
      doc.fontSize(11).font("Helvetica-Bold").fillColor(NISIT_COLOR).text(`SUBJECT: LETTER OF OFFER — ${position.toUpperCase()}`, mx);
      doc.moveDown(0.8);
      divider(doc);
      bodyText(doc, `Dear ${candidateName},`);
      bodyText(doc, `On behalf of ${agencyName}, I am pleased to inform you that following a rigorous recruitment and selection process, the Selection Committee has recommended your appointment to the position of ${position}. This letter formally offers you employment subject to the terms and conditions set out below.`);
      sectionLabel(doc, "1. Position Details");
      fieldRow(doc, "Position Title", position);
      fieldRow(doc, "Department / Division", department?.name ?? "As notified");
      fieldRow(doc, "Grade / Band", job?.gradeBand ?? "As per government salary schedule");
      fieldRow(doc, "Employment Type", job?.employmentType ? job.employmentType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) : "As specified in contract");
      doc.moveDown(0.5);
      sectionLabel(doc, "2. Remuneration");
      fieldRow(doc, "Annual Salary Range", fmtSalary(job?.salaryMin, job?.salaryMax, job?.salaryCurrency));
      fieldRow(doc, "Agreed / Expected Salary", appRow.expectedSalary ? `${job?.salaryCurrency ?? "PGK"} ${appRow.expectedSalary} per annum` : "As per grade schedule");
      doc.moveDown(0.5);
      sectionLabel(doc, "3. Conditions of Employment");
      bodyText(doc, `Your appointment is subject to satisfactory completion of background checks, reference verification, and medical fitness clearance. The appointment will be governed by the Public Services (Management) Act 2014 and the relevant Enterprise Agreement currently in force.`);
      sectionLabel(doc, "4. Acceptance");
      bodyText(doc, `Please indicate your acceptance of this offer by signing and returning a copy of this letter within seven (7) working days of the date above. Failure to do so may result in this offer being withdrawn.`);
      bodyText(doc, `We look forward to welcoming you to the ${agencyName} team. Should you have any queries, please do not hesitate to contact the Human Resources Division.`);
      divider(doc);
      signatureBlock(doc);

      doc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);

    try {
      await sendOfferLetterEmail(candidateEmail, candidateName, position, pdfBuffer, applicationId);
      logger.info({ applicationId, to: candidateEmail }, "Offer letter emailed to candidate");

      const sentAt = new Date();
      await db
        .update(applicationsTable)
        .set({ offerLetterSentAt: sentAt })
        .where(eq(applicationsTable.id, applicationId));

      // Append to the offer-letter send audit log
      try {
        await db.insert(offerLetterSendLogTable).values({
          applicationId,
          userId: req.user?.userId ?? null,
          recipientEmail: candidateEmail,
          sentAt,
        });
      } catch (logErr) {
        logger.warn({ err: logErr, applicationId }, "Failed to record offer-letter send log entry");
      }

      const notifMessage = `Offer letter for "${position}" (application #${applicationId}) was emailed to ${candidateName} <${candidateEmail}>.`;
      const notifType = "offer_letter_sent";

      const promises: Promise<void>[] = [];
      if (req.user?.userId) {
        promises.push(createNotification({ userId: req.user.userId, type: notifType, message: notifMessage }));
      }
      const agencyIdForNotif = job?.agencyId ?? req.user?.agencyId ?? null;
      promises.push(notifyAdmins(agencyIdForNotif, notifType, notifMessage));

      // Notify the applicant that they have been sent an offer letter
      const applicantUserId = candidateEmail ? await getUserIdByEmail(candidateEmail) : null;
      if (applicantUserId) {
        promises.push(createNotification({
          userId: applicantUserId,
          type: "offer_letter_sent",
          message: `A letter of offer for the position of "${position}" has been emailed to you. Please check your inbox.`,
        }));
      }

      await Promise.allSettled(promises);

      res.json({ success: true, sentTo: candidateEmail, offerLetterSentAt: sentAt.toISOString() });
    } catch (err) {
      logger.error({ err, applicationId }, "Failed to send offer letter email");
      res.status(500).json({ error: "Failed to send offer letter email. Check SMTP configuration." });
    }
  }
);

// ─── GET /api/pdf/contract/:contractId ───────────────────────────────────────

router.get(
  "/pdf/contract/:contractId",
  authMiddleware,
  requireRole("admin", "hr_officer"),
  async (req: Request, res: Response) => {
    const contractId = parseIntParam(req.params.contractId);

    const [contract] = await db
      .select()
      .from(contractsTable)
      .where(eq(contractsTable.id, contractId));

    if (!contract) {
      res.status(404).json({ error: "Contract not found" });
      return;
    }

    // Tenant access: derive the employee's agency and assert the requesting user belongs to it
    const [empForTenant] = contract.employeeId
      ? await db.select({ agencyId: employeesTable.agencyId }).from(employeesTable).where(eq(employeesTable.id, contract.employeeId))
      : [];
    if (!assertTenantAccess(res, empForTenant?.agencyId ?? null, getTenantAgencyId(req))) return;

    const [employee] = contract.employeeId
      ? await db.select().from(employeesTable).where(eq(employeesTable.id, contract.employeeId))
      : [];

    const [position] = employee?.positionId
      ? await db.select().from(positionsTable).where(eq(positionsTable.id, employee.positionId))
      : [];

    const [department] = employee?.departmentId
      ? await db.select().from(departmentsTable).where(eq(departmentsTable.id, employee.departmentId))
      : [];

    const agencyId = employee?.agencyId ?? req.user?.agencyId;
    const [agency] = agencyId
      ? await db.select().from(agenciesTable).where(eq(agenciesTable.id, agencyId))
      : [];

    const agencyName = agency?.name ?? "PNG National Information & Communications Technology Institute (NISIT)";
    const employeeName = employee?.name ?? "Employee";
    const positionTitle = position?.title ?? "Position";
    const contractTypeLabel = (contract.type ?? "fixed_term").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    const refNo = `NISIT/HR/EC/${new Date().getFullYear()}/${String(contractId).padStart(4, "0")}`;

    const doc = new PDFDocument({ size: "A4", margins: { top: 100, bottom: 60, left: 72, right: 72 }, compress: true });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="contract-${contractId}.pdf"`);
    doc.pipe(res);

    attachFooterToAllPages(doc, agencyName, refNo, "Official Contract");
    drawLetterhead(doc, agencyName);
    doc.moveDown(1.2);

    const mx = doc.page.margins.left;
    doc.fontSize(9).font("Helvetica").fillColor("#555555").text(`Ref: ${refNo}`, mx);
    doc.text(`Date: ${fmtDate(new Date())}`, mx);
    doc.moveDown(1);

    // Title
    doc.fontSize(13).font("Helvetica-Bold").fillColor(NISIT_COLOR)
      .text("EMPLOYMENT CONTRACT", mx, undefined, { align: "center", width: doc.page.width - mx * 2 });
    doc.moveDown(0.4);
    doc.fontSize(10).font("Helvetica").fillColor("#555555")
      .text(`Contract Type: ${contractTypeLabel}`, mx, undefined, { align: "center", width: doc.page.width - mx * 2 });
    doc.moveDown(1);
    divider(doc);

    // Parties
    sectionLabel(doc, "1. Parties");
    bodyText(doc,
      `This Employment Contract ("Contract") is entered into between ${agencyName} ` +
      `("The Employer") and ${employeeName} ("The Employee").`
    );

    sectionLabel(doc, "2. Position & Department");
    fieldRow(doc, "Position Title", positionTitle);
    fieldRow(doc, "Department / Division", department?.name ?? "As assigned");
    fieldRow(doc, "Employment Type", contractTypeLabel);
    doc.moveDown(0.5);

    sectionLabel(doc, "3. Contract Duration & Working Hours");
    fieldRow(doc, "Start Date", fmtDate(contract.startDate));
    fieldRow(doc, "End Date", contract.endDate ? fmtDate(contract.endDate) : "Ongoing (Permanent Appointment)");
    if (contract.probationPeriod) {
      fieldRow(doc, "Probation Period", contract.probationPeriod);
    }
    if (contract.workingHours) {
      fieldRow(doc, "Working Hours", contract.workingHours);
    }
    doc.moveDown(0.5);

    sectionLabel(doc, "4. Remuneration & Benefits");
    if (contract.salary && contract.salary.trim()) {
      bodyText(doc, contract.salary.trim());
      doc.moveDown(0.3);
      bodyText(doc,
        `All statutory deductions (tax/IRC and superannuation/Nasfund) shall apply in accordance with the laws of Papua New Guinea.`
      );
    } else {
      bodyText(doc,
        `The Employee shall be remunerated in accordance with the applicable government salary ` +
        `schedule, grade band, and any applicable allowances as determined by the Department of Personnel ` +
        `Management (DPM) and agreed at the time of appointment.`
      );
    }

    sectionLabel(doc, "5. Duties & Responsibilities");
    if (contract.duties && contract.duties.trim()) {
      bodyText(doc, contract.duties.trim());
    } else {
      bodyText(doc,
        `The Employee agrees to perform the duties and responsibilities associated with the position of ` +
        `${positionTitle}, as outlined in the relevant Position Description. The Employee may be assigned ` +
        `additional duties consistent with the level of the position from time to time.`
      );
    }

    sectionLabel(doc, "6. Leave Entitlements");
    bodyText(doc,
      `The Employee is entitled to leave in accordance with the provisions of the Public Services ` +
      `(Management) Act 2014 and applicable government policy, including Annual Leave, Sick Leave, ` +
      `Maternity/Paternity Leave, and other statutory entitlements.`
    );

    sectionLabel(doc, "7. Termination & Notice Period");
    if (contract.noticePeriod && contract.noticePeriod.trim()) {
      bodyText(doc,
        `Notice Period: ${contract.noticePeriod.trim()}. Either party may terminate this Contract by providing the written notice specified herein or payment in lieu thereof, subject to the Public Services (Management) Act 2014.`
      );
    } else {
      bodyText(doc,
        `Either party may terminate this Contract by providing the notice period specified in the ` +
        `relevant Enterprise Agreement or as required by law. The Employer reserves the right to ` +
        `terminate this Contract in accordance with the Public Services (Management) Act 2014.`
      );
    }

    sectionLabel(doc, "8. Confidentiality & Code of Conduct");
    bodyText(doc,
      `The Employee agrees to maintain strict confidentiality regarding all government information, ` +
      `data, and documents accessed in the course of employment, both during and after the term of this Contract, and uphold the Public Service Code of Conduct.`
    );

    if ((contract.specialConditions && contract.specialConditions.trim()) || (contract.customClauses && contract.customClauses.trim())) {
      sectionLabel(doc, "9. Special Conditions & Custom Clauses");
      if (contract.specialConditions && contract.specialConditions.trim()) {
        fieldRow(doc, "Special Conditions", contract.specialConditions.trim());
      }
      if (contract.customClauses && contract.customClauses.trim()) {
        bodyText(doc, contract.customClauses.trim());
      }
    }

    divider(doc);

    // Execution block
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica-Bold").text("EXECUTION", mx);
    doc.moveDown(0.5);
    bodyText(doc, "By signing below, both parties agree to be bound by the terms and conditions of this Contract.");
    doc.moveDown(1.5);

    const col2 = mx + 280;
    const lineLen = 170;
    const signY = doc.y;

    doc.strokeColor("#000000").moveTo(mx, signY).lineTo(mx + lineLen, signY).lineWidth(0.8).stroke();
    doc.strokeColor("#000000").moveTo(col2, signY).lineTo(col2 + lineLen, signY).lineWidth(0.8).stroke();
    doc.moveDown(0.3);

    doc.fontSize(9).font("Helvetica-Bold").text("Signature — Employer", mx, doc.y);
    doc.text("Signature — Employee", col2, doc.y - doc.currentLineHeight());
    doc.moveDown(1.5);

    const nameY = doc.y;
    doc.strokeColor("#000000").moveTo(mx, nameY).lineTo(mx + lineLen, nameY).lineWidth(0.8).stroke();
    doc.strokeColor("#000000").moveTo(col2, nameY).lineTo(col2 + lineLen, nameY).lineWidth(0.8).stroke();
    doc.moveDown(0.3);
    doc.fontSize(9).text("Name / Title", mx, doc.y);
    doc.text("Name of Employee", col2, doc.y - doc.currentLineHeight());
    doc.moveDown(1.5);

    const dateY = doc.y;
    doc.strokeColor("#000000").moveTo(mx, dateY).lineTo(mx + 100, dateY).lineWidth(0.8).stroke();
    doc.strokeColor("#000000").moveTo(col2, dateY).lineTo(col2 + 100, dateY).lineWidth(0.8).stroke();
    doc.moveDown(0.3);
    doc.text("Date", mx, doc.y);
    doc.text("Date", col2, doc.y - doc.currentLineHeight());

    // Official Seal on the bottom-centre
    doc.moveDown(1.5);
    const stampX = (doc.page.width - 170) / 2;
    drawOfficialStamp(doc, stampX, doc.y, refNo, fmtDate(new Date()));

    doc.end();
  }
);

// ─── GET /api/pdf/offer-letter-history/:applicationId ───────────────────────
// Returns the full audit trail of every offer-letter send event for an application.

router.get(
  "/pdf/offer-letter-history/:applicationId",
  authMiddleware,
  requireRole("admin", "hr_officer", "hiring_manager"),
  async (req: Request, res: Response) => {
    const applicationId = parseIntParam(req.params.applicationId);

    const [appRow] = await db
      .select({ jobId: applicationsTable.jobId })
      .from(applicationsTable)
      .where(eq(applicationsTable.id, applicationId));

    if (!appRow) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    const [jobForTenant] = await db
      .select({ agencyId: jobsTable.agencyId })
      .from(jobsTable)
      .where(eq(jobsTable.id, appRow.jobId));
    if (!assertTenantAccess(res, jobForTenant?.agencyId ?? null, getTenantAgencyId(req))) return;

    const rows = await db
      .select({
        id: offerLetterSendLogTable.id,
        sentAt: offerLetterSendLogTable.sentAt,
        recipientEmail: offerLetterSendLogTable.recipientEmail,
        userId: offerLetterSendLogTable.userId,
        userName: usersTable.name,
        userEmail: usersTable.email,
      })
      .from(offerLetterSendLogTable)
      .leftJoin(usersTable, eq(offerLetterSendLogTable.userId, usersTable.id))
      .where(eq(offerLetterSendLogTable.applicationId, applicationId))
      .orderBy(desc(offerLetterSendLogTable.sentAt));

    res.json(rows);
  }
);

export default router;
