import { Router, type IRouter } from "express";
import { eq, and, desc, isNull } from "drizzle-orm";
import { db, employeeDocumentsTable, employeeDocumentVersionsTable, hrLetterRequestsTable, employeesTable, departmentsTable, positionsTable, usersTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/auth";
import { getGrantedScopes } from "../middlewares/authorization";
import { getTenantAgencyId } from "../middlewares/tenant";
import { canManageEmployee, currentEmployeeId, hasHrAccess } from "../lib/employee-access";

const router: IRouter = Router();

async function getCurrentEmployeeId(userId: number): Promise<number | null> {
  const [user] = await db.select({ employeeId: usersTable.employeeId, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) return null;
  if (user.employeeId) return user.employeeId;
  const [employee] = await db.select({ id: employeesTable.id }).from(employeesTable).where(eq(employeesTable.email, user.email));
  return employee?.id ?? null;
}

async function canAccessEmployeeDocuments(req: Parameters<typeof getGrantedScopes>[0], employeeId: number, action: string): Promise<boolean> {
  const scopes = await getGrantedScopes(req, "documents", action);
  if (!scopes.length) return false;
  const [employee] = await db.select({ id: employeesTable.id, agencyId: employeesTable.agencyId }).from(employeesTable).where(eq(employeesTable.id, employeeId));
  if (!employee) return false;
  const tenantAgencyId = getTenantAgencyId(req);
  if (tenantAgencyId != null && employee.agencyId !== tenantAgencyId) return false;
  if (scopes.includes("organisation")) return true;
  if (scopes.includes("own")) return employee.id === await getCurrentEmployeeId(req.user!.userId);
  // Department-scoped permission needs a department/manager model; deny it
  // until that mapping exists rather than accidentally treating it as org-wide.
  return false;
}

// GET /api/documents - List employee documents
router.get("/documents", authMiddleware, async (req, res): Promise<void> => {
  try {
    const employeeIdParam = req.query.employee_id ? parseInt(req.query.employee_id as string) : undefined;
    const categoryParam = req.query.category as string | undefined;

    const conditions = [];
    conditions.push(isNull(employeeDocumentsTable.deletedAt));
    const scopes = await getGrantedScopes(req, "documents", "read");
    if (!scopes.length) {
      res.status(403).json({ error: "Forbidden: requires documents.read" });
      return;
    }
    if (employeeIdParam) {
      if (!await canAccessEmployeeDocuments(req, employeeIdParam, "read")) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      conditions.push(eq(employeeDocumentsTable.employeeId, employeeIdParam));
    } else if (scopes.includes("organisation")) {
      const agencyId = getTenantAgencyId(req);
      if (agencyId != null) conditions.push(eq(employeesTable.agencyId, agencyId));
    } else if (scopes.includes("own")) {
      const ownEmployeeId = await getCurrentEmployeeId(req.user!.userId);
      if (!ownEmployeeId) {
        res.json([]);
        return;
      }
      conditions.push(eq(employeeDocumentsTable.employeeId, ownEmployeeId));
    } else {
      res.status(403).json({ error: "Forbidden: no supported document scope" });
      return;
    }
    if (categoryParam && categoryParam !== "all") conditions.push(eq(employeeDocumentsTable.category, categoryParam));

    const docs = await db
      .select({
        id: employeeDocumentsTable.id,
        employeeId: employeeDocumentsTable.employeeId,
        employeeName: employeesTable.name,
        category: employeeDocumentsTable.category,
        title: employeeDocumentsTable.title,
        fileUrl: employeeDocumentsTable.fileUrl,
        fileSize: employeeDocumentsTable.fileSize,
        mimeType: employeeDocumentsTable.mimeType,
        expiryDate: employeeDocumentsTable.expiryDate,
        createdAt: employeeDocumentsTable.createdAt,
      })
      .from(employeeDocumentsTable)
      .leftJoin(employeesTable, eq(employeeDocumentsTable.employeeId, employeesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(employeeDocumentsTable.createdAt));

    res.json(docs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// POST /api/documents - Upload / Register document
router.post("/documents", authMiddleware, async (req, res): Promise<void> => {
  try {
    const { employeeId, category, title, fileUrl, fileSize, mimeType, expiryDate, retentionUntil } = req.body;
    const targetEmployeeId = employeeId ? parseInt(employeeId) : await getCurrentEmployeeId(req.user!.userId);

    if (!targetEmployeeId || !await canAccessEmployeeDocuments(req, targetEmployeeId, "create")) {
      res.status(403).json({ error: "Forbidden: requires documents.create for this employee" });
      return;
    }

    if (!title) {
      res.status(400).json({ error: "Document title is required" });
      return;
    }

    const [doc] = await db
      .insert(employeeDocumentsTable)
      .values({
        employeeId: targetEmployeeId,
        category: category || "identification",
        title,
        fileUrl: fileUrl || "https://storage.nisit.gov.pg/documents/sample-doc.pdf",
        fileSize: fileSize ? parseInt(fileSize) : null,
        mimeType: mimeType || "application/pdf",
        expiryDate: expiryDate || null,
        retentionUntil: retentionUntil || null,
        uploadedByUserId: req.user?.userId,
      })
      .returning();
    await db.insert(employeeDocumentVersionsTable).values({ documentId: doc.id, version: 1, fileUrl: doc.fileUrl, fileSize: doc.fileSize, mimeType: doc.mimeType, uploadedByUserId: req.user?.userId ?? null });

    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ error: "Failed to create document record" });
  }
});

// DELETE /api/documents/:id - Delete document
router.delete("/documents/:id", authMiddleware, async (req, res): Promise<void> => {
  try {
    const docId = parseInt(req.params.id as string);
    const [document] = await db.select({ employeeId: employeeDocumentsTable.employeeId }).from(employeeDocumentsTable).where(eq(employeeDocumentsTable.id, docId));
    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    if (!await canAccessEmployeeDocuments(req, document.employeeId, "delete")) {
      res.status(403).json({ error: "Forbidden: requires documents.delete for this employee" });
      return;
    }
    await db.update(employeeDocumentsTable).set({ deletedAt: new Date(), deletedByUserId: req.user!.userId }).where(eq(employeeDocumentsTable.id, docId));
    res.json({ success: true, message: "Document deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// GET /api/hr-letters - List HR letter requests
router.get("/hr-letters", authMiddleware, requireRole("admin", "hr_manager", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const employeeIdParam = req.query.employee_id ? parseInt(req.query.employee_id as string) : undefined;
    const conditions = [];
    if (employeeIdParam) conditions.push(eq(hrLetterRequestsTable.employeeId, employeeIdParam));

    const requests = await db
      .select({
        id: hrLetterRequestsTable.id,
        employeeId: hrLetterRequestsTable.employeeId,
        employeeName: employeesTable.name,
        letterType: hrLetterRequestsTable.letterType,
        addressee: hrLetterRequestsTable.addressee,
        purpose: hrLetterRequestsTable.purpose,
        status: hrLetterRequestsTable.status,
        generatedLetterContent: hrLetterRequestsTable.generatedLetterContent,
        generatedAt: hrLetterRequestsTable.generatedAt,
        rejectionReason: hrLetterRequestsTable.rejectionReason,
        createdAt: hrLetterRequestsTable.createdAt,
      })
      .from(hrLetterRequestsTable)
      .leftJoin(employeesTable, eq(hrLetterRequestsTable.employeeId, employeesTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(hrLetterRequestsTable.createdAt));

    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch HR letter requests" });
  }
});

// POST /api/hr-letters/request - Request HR letter
router.post("/hr-letters/request", authMiddleware, async (req, res): Promise<void> => {
  try {
    const { employeeId, letterType, addressee, purpose } = req.body;

    if (!letterType || !addressee || !purpose) {
      res.status(400).json({ error: "Letter type, addressee, and purpose are required" });
      return;
    }

    let targetEmployeeId = employeeId ? parseInt(employeeId) : undefined;
    const ownEmployeeId = await currentEmployeeId(req);

    if (!targetEmployeeId) {
      targetEmployeeId = ownEmployeeId ?? undefined;
    }

    if (!targetEmployeeId) {
      const [firstEmp] = await db.select({ id: employeesTable.id }).from(employeesTable).limit(1);
      targetEmployeeId = firstEmp?.id;
    }

    if (!targetEmployeeId) {
      res.status(400).json({ error: "No employee record found to issue letter for" });
      return;
    }

    const isHrOrAdmin = hasHrAccess(req) || req.user?.roleName === "admin" || req.user?.roleName === "hr_officer";
    if (!isHrOrAdmin && targetEmployeeId !== ownEmployeeId) {
      res.status(403).json({ error: "Forbidden: cannot request a letter for this employee" });
      return;
    }

    const [letterReq] = await db
      .insert(hrLetterRequestsTable)
      .values({
        employeeId: targetEmployeeId,
        letterType,
        addressee,
        purpose,
        status: "pending",
      })
      .returning();

    res.status(201).json(letterReq);
  } catch (error: any) {
    res.status(500).json({ error: error?.message || "Failed to request HR letter" });
  }
});

// POST /api/hr-letters/generate - Generate official letter (auto-filled template)
router.post("/hr-letters/generate", authMiddleware, requireRole("admin", "hr_manager", "hr_officer"), async (req, res): Promise<void> => {
  try {
    const { requestId, employeeId, letterType, addressee, purpose } = req.body;

    let targetEmpId = employeeId ? parseInt(employeeId) : undefined;
    if (requestId) {
      const existing = await db.select().from(hrLetterRequestsTable).where(eq(hrLetterRequestsTable.id, parseInt(requestId))).limit(1);
      if (existing.length > 0) targetEmpId = existing[0].employeeId;
    }

    if (!targetEmpId) {
      const ownEmp = await currentEmployeeId(req);
      targetEmpId = ownEmp ?? undefined;
    }

    if (!targetEmpId) {
      const [firstEmp] = await db.select({ id: employeesTable.id }).from(employeesTable).limit(1);
      targetEmpId = firstEmp?.id;
    }

    if (!targetEmpId) {
      res.status(400).json({ error: "Employee ID is required" });
      return;
    }

    const empData = await db
      .select({
        id: employeesTable.id,
        name: employeesTable.name,
        startDate: employeesTable.startDate,
        departmentName: departmentsTable.name,
        positionTitle: positionsTable.title,
      })
      .from(employeesTable)
      .leftJoin(departmentsTable, eq(employeesTable.departmentId, departmentsTable.id))
      .leftJoin(positionsTable, eq(employeesTable.positionId, positionsTable.id))
      .where(eq(employeesTable.id, targetEmpId))
      .limit(1);

    if (empData.length === 0) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    const emp = empData[0];
    const currentDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const targetAddressee = addressee || "TO WHOM IT MAY CONCERN";

    let letterContent = "";
    if (letterType === "salary_confirmation") {
      letterContent = `NATIONAL INSTITUTE OF STANDARDS & INDUSTRIAL TECHNOLOGY (NISIT)
P.O. Box 1071, Port Moresby, National Capital District, Papua New Guinea

Date: ${currentDate}

${targetAddressee}

CONFIRMATION OF EMPLOYMENT AND REMUNERATION

This letter serves to confirm that ${emp.name} is a permanent full-time employee of the National Institute of Standards and Industrial Technology (NISIT).

Current Employment Particulars:
- Position / Designation: ${emp.positionTitle || "Officer"}
- Department / Division: ${emp.departmentName || "General Administration"}
- Date of Commencement: ${emp.startDate || "Active"}
- Current Base Remuneration: PGK 75,000.00/annum (exclusive of standard public service allowances)

This confirmation is issued upon the request of the employee for the purpose of ${purpose || "financial verification"}.

Yours faithfully,

Director of Human Resources & Corporate Services
National Institute of Standards & Industrial Technology (NISIT)`;
    } else {
      letterContent = `NATIONAL INSTITUTE OF STANDARDS & INDUSTRIAL TECHNOLOGY (NISIT)
P.O. Box 1071, Port Moresby, National Capital District, Papua New Guinea

Date: ${currentDate}

${targetAddressee}

CERTIFICATE OF EMPLOYMENT AND SERVICE VERIFICATION

To whom it may concern,

We hereby certify that ${emp.name} is currently employed with the National Institute of Standards and Industrial Technology (NISIT) in the capacity of ${emp.positionTitle || "Staff Member"} within the ${emp.departmentName || "Operations Division"}.

${emp.name} commenced duties with NISIT on ${emp.startDate || "Record Date"} and continues to serve in good standing as a valued member of our statutory workforce.

Should you require any further information or formal verification, please do not hesitate to contact the NISIT Corporate Services Division at hr@nisit.gov.pg.

Yours faithfully,

Director of Human Resources & Corporate Services
National Institute of Standards & Industrial Technology (NISIT)`;
    }

    if (requestId) {
      await db
        .update(hrLetterRequestsTable)
        .set({
          status: "generated",
          generatedLetterContent: letterContent,
          generatedByUserId: req.user?.userId,
          generatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(hrLetterRequestsTable.id, parseInt(requestId)));
    }

    res.json({
      success: true,
      letterContent,
      employee: emp,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate HR letter" });
  }
});

export default router;
