import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { eq } from "drizzle-orm";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { db, applicationsTable, applicationDocumentsTable, candidatesTable, employeeDocumentsTable, employeesTable, contractsTable } from "@workspace/db";
import { jobsTable } from "@workspace/db/schema";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { setObjectAclPolicy, canAccessObjectForAgency } from "../lib/objectAcl";
import { authMiddleware, requireRole } from "../middlewares/auth";
import { canReadEmployee, hasSensitiveReadAccess } from "../lib/employee-access";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// Defense in depth for authenticated applicant uploads.
const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many upload requests. Please try again later." },
});

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const extensionAllowed = /\.(pdf|docx?|jpe?g|png|webp)$/i.test(file.originalname);
    if (ALLOWED_MIME_TYPES.has(file.mimetype) && extensionAllowed) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, Word documents, and images are allowed"));
    }
  },
});

/**
 * Helper to ensure local uploads directory exists
 */
function getLocalUploadsDir(): string {
  const dir = path.resolve(process.cwd(), "uploads");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * POST /upload
 *
 * Authenticated multipart file upload endpoint for applicants submitting CVs.
 * Accepts multipart/form-data with fields:
 *   - file: the document (PDF, DOC, DOCX — max 15 MB)
 *   - jobId: ID of the job being applied to (used to derive the owning agency for ACL)
 *
 * Uploads to GCS if configured, or gracefully falls back to local disk storage.
 */
router.post("/upload", authMiddleware, uploadRateLimit, (req: Request, res: Response) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      const message =
        err instanceof multer.MulterError
          ? err.code === "LIMIT_FILE_SIZE"
            ? "File too large (max 15 MB)"
            : err.message
          : (err as Error).message ?? "Invalid file";
      res.status(400).json({ error: message });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const rawJobId = req.body?.jobId;
    const jobId = rawJobId ? parseInt(String(rawJobId), 10) : NaN;
    if (!rawJobId || isNaN(jobId)) {
      res.status(400).json({ error: "jobId is required to associate the document with a tenant" });
      return;
    }

    try {
      // Derive the owning agency from the job (tenant scoping)
      const [job] = await db
        .select({ agencyId: jobsTable.agencyId })
        .from(jobsTable)
        .where(eq(jobsTable.id, jobId))
        .limit(1);

      if (!job) {
        res.status(400).json({ error: "Job not found" });
        return;
      }

      let url = "";
      let objectPath = "";

      // 1. Try GCS upload if PRIVATE_OBJECT_DIR is set
      if (process.env.PRIVATE_OBJECT_DIR) {
        try {
          const uploadURL = await objectStorageService.getObjectEntityUploadURL();
          objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

          const uploadRes = await fetch(uploadURL, {
            method: "PUT",
            headers: { "Content-Type": req.file.mimetype },
            body: new Uint8Array(req.file.buffer),
          });

          if (uploadRes.ok) {
            const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
            await setObjectAclPolicy(objectFile, {
              owner: String(job.agencyId),
              visibility: "private",
            });
            url = `/api/storage${objectPath}`;
          }
        } catch (gcsError) {
          req.log?.warn?.({ err: gcsError }, "GCS upload skipped/failed; using local storage fallback");
        }
      }

      // 2. Local disk fallback (standard for VPS and self-hosted deployments)
      if (!url) {
        const uploadsDir = getLocalUploadsDir();
        const ext = path.extname(req.file.originalname) || ".pdf";
        const safeBase = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
        const uniqueFileName = `${Date.now()}_${randomUUID().slice(0, 8)}_${safeBase}${ext}`;
        const diskPath = path.join(uploadsDir, uniqueFileName);

        fs.writeFileSync(diskPath, req.file.buffer);

        objectPath = `/local/${uniqueFileName}`;
        url = `/api/storage${objectPath}`;
      }

      res.json({ url, objectPath });
    } catch (error) {
      req.log?.error?.({ err: error }, "Error in file upload");
      res.status(500).json({ error: "Failed to upload file" });
    }
  });
});

/**
 * GET /storage/local/:filename
 *
 * Serves locally stored uploaded files directly with correct content types
 */
router.get("/storage/local/:filename", authMiddleware, async (req: Request, res: Response) => {
  try {
    const rawFilename = Array.isArray(req.params.filename) ? req.params.filename[0] : req.params.filename;
    const filename = path.basename(rawFilename ?? "");
    const diskPath = path.join(getLocalUploadsDir(), filename);

    if (!fs.existsSync(diskPath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    // A storage filename is not a permission. Resolve it to a protected HR record
    // and deny access unless the caller can read that record.
    const storageUrl = `/api/storage/local/${filename}`;
    const [applicationDocument] = await db.select({ candidateUserId: candidatesTable.userId, agencyId: jobsTable.agencyId })
      .from(applicationDocumentsTable)
      .innerJoin(applicationsTable, eq(applicationDocumentsTable.applicationId, applicationsTable.id))
      .innerJoin(candidatesTable, eq(applicationsTable.candidateId, candidatesTable.id))
      .innerJoin(jobsTable, eq(applicationsTable.jobId, jobsTable.id))
      .where(eq(applicationDocumentsTable.url, storageUrl)).limit(1);
    const [employeeDocument] = await db.select({ employeeId: employeeDocumentsTable.employeeId })
      .from(employeeDocumentsTable).where(eq(employeeDocumentsTable.fileUrl, storageUrl)).limit(1);
    const [contract] = await db.select({ employeeId: contractsTable.employeeId, agencyId: employeesTable.agencyId })
      .from(contractsTable).innerJoin(employeesTable, eq(contractsTable.employeeId, employeesTable.id))
      .where(eq(contractsTable.documentUrl, storageUrl)).limit(1);
    const user = req.user!;
    const applicantOwnsDocument = applicationDocument?.candidateUserId === user.userId;
    const staffCanReadApplication = hasSensitiveReadAccess(req) && !!applicationDocument && (user.agencyId == null || applicationDocument.agencyId === user.agencyId);
    const staffCanReadContract = hasSensitiveReadAccess(req) && !!contract && (user.agencyId == null || contract.agencyId === user.agencyId);
    if (!applicantOwnsDocument && !staffCanReadApplication && !(employeeDocument && await canReadEmployee(req, employeeDocument.employeeId)) && !staffCanReadContract && !(contract && await canReadEmployee(req, contract.employeeId))) {
      res.status(403).json({ error: "Forbidden: no access to this document" });
      return;
    }

    res.sendFile(diskPath);
  } catch (err) {
    res.status(500).json({ error: "Failed to read local file" });
  }
});

/**
 * POST /storage/uploads/request-url
 */
router.post(
  "/storage/uploads/request-url",
  authMiddleware,
  requireRole("admin", "hr_officer", "hiring_manager", "executive"),
  async (req: Request, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required fields" });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;

      if (process.env.PRIVATE_OBJECT_DIR) {
        try {
          const uploadURL = await objectStorageService.getObjectEntityUploadURL();
          const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

          res.json(
            RequestUploadUrlResponse.parse({
              uploadURL,
              objectPath,
              metadata: { name, size, contentType },
            }),
          );
          return;
        } catch {}
      }

      // Local upload URL fallback
      const objectId = randomUUID();
      res.json({
        uploadURL: `/api/storage/uploads/local-direct?id=${objectId}`,
        objectPath: `/local/${objectId}_${name.replace(/[^a-zA-Z0-9_-]/g, "_")}`,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      req.log?.error?.({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * POST /storage/uploads/confirm
 */
router.post(
  "/storage/uploads/confirm",
  authMiddleware,
  requireRole("admin", "hr_officer", "hiring_manager", "executive"),
  async (req: Request, res: Response) => {
    const { objectPath } = req.body as { objectPath?: string };
    if (!objectPath || typeof objectPath !== "string") {
      res.status(400).json({ error: "objectPath is required" });
      return;
    }

    const user = req.user!;
    if (user.agencyId == null) {
      res.status(400).json({ error: "User has no agency assignment; cannot set tenant ACL" });
      return;
    }

    if (objectPath.startsWith("/local/")) {
      res.json({ objectPath, owner: String(user.agencyId) });
      return;
    }

    try {
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      await setObjectAclPolicy(objectFile, {
        owner: String(user.agencyId),
        visibility: "private",
      });
      res.json({ objectPath, owner: String(user.agencyId) });
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Object not found — ensure the file was uploaded before confirming" });
        return;
      }
      res.json({ objectPath, owner: String(user.agencyId) });
    }
  },
);

/**
 * GET /storage/public-objects/*
 */
router.get(
  "/storage/public-objects/*filePath",
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join("/") : raw;
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      const response = await objectStorageService.downloadObject(file);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        );
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log?.error?.({ err: error }, "Error serving public object");
      res.status(500).json({ error: "Failed to serve public object" });
    }
  },
);

/**
 * GET /storage/objects/*path
 */
router.get(
  "/storage/objects/*path",
  authMiddleware,
  requireRole("admin", "hr_officer", "hiring_manager", "executive"),
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.path;
      const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
      
      // Check if it is a local upload
      if (wildcardPath.startsWith("local/")) {
        const filename = path.basename(wildcardPath);
        const diskPath = path.join(getLocalUploadsDir(), filename);
        if (fs.existsSync(diskPath)) {
          res.sendFile(diskPath);
          return;
        }
      }

      const objectPath = `/objects/${wildcardPath}`;
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

      const user = req.user!;
      const allowed = await canAccessObjectForAgency(objectFile, user.agencyId ?? null);
      if (!allowed) {
        res.status(403).json({ error: "Forbidden: no access to this document" });
        return;
      }

      const response = await objectStorageService.downloadObject(objectFile);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        );
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Object not found" });
        return;
      }
      res.status(500).json({ error: "Failed to serve object" });
    }
  },
);

export default router;
