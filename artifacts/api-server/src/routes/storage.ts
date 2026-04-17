import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import multer from "multer";
import { eq } from "drizzle-orm";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import { jobsTable } from "@workspace/db/schema";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { setObjectAclPolicy, getObjectAclPolicy } from "../lib/objectAcl";
import { authMiddleware, requireRole } from "../middlewares/auth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and Word documents are allowed"));
    }
  },
});

/**
 * POST /upload
 *
 * Public multipart file upload endpoint for applicants submitting CVs during job application.
 * Accepts multipart/form-data with fields:
 *   - file: the document (PDF, DOC, DOCX — max 10 MB)
 *   - jobId: ID of the job being applied to (used to derive the owning agency for ACL)
 *
 * Uploads the file server-side to GCS and sets an ACL policy so only users from the
 * same agency can retrieve it. Returns the serving URL.
 */
router.post("/upload", (req: Request, res: Response) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      const message =
        err instanceof multer.MulterError
          ? err.code === "LIMIT_FILE_SIZE"
            ? "File too large (max 10 MB)"
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

      // Generate a presigned GCS URL and upload the file server-side
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": req.file.mimetype },
        body: new Uint8Array(req.file.buffer),
      });

      if (!uploadRes.ok) {
        req.log.error({ status: uploadRes.status }, "GCS upload failed");
        res.status(500).json({ error: "Failed to store file" });
        return;
      }

      // Set ACL policy — owner is the agency ID (string), visibility private
      // This enforces tenant isolation on retrieval via canAccessObjectEntity
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      await setObjectAclPolicy(objectFile, {
        owner: String(job.agencyId),
        visibility: "private",
      });

      res.json({ url: `/api/storage${objectPath}`, objectPath });
    } catch (error) {
      req.log.error({ err: error }, "Error in file upload");
      res.status(500).json({ error: "Failed to upload file" });
    }
  });
});

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for direct client-to-GCS upload (HR staff only).
 * Requires JWT authentication and an HR staff role.
 * The client sends JSON metadata, then uploads directly to GCS.
 * After uploading, call POST /storage/uploads/confirm to apply tenant ACL.
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

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * POST /storage/uploads/confirm
 *
 * Apply tenant ACL policy to an object that was uploaded via a presigned URL (staff flow).
 * Must be called AFTER the client has PUT the file to the GCS presigned URL.
 * Requires JWT authentication and HR staff role. Sets ACL owner to the caller's agencyId.
 *
 * Body: { objectPath: string } — the objectPath returned by POST /storage/uploads/request-url
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
      req.log.error({ err: error }, "Error setting object ACL");
      res.status(500).json({ error: "Failed to confirm upload ACL" });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
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
      req.log.error({ err: error }, "Error serving public object");
      res.status(500).json({ error: "Failed to serve public object" });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve private object entities (uploaded CVs, contracts, certificates).
 * Access control is enforced at two levels:
 *   1. Role-level: must be an authenticated HR staff member (admin, hr_officer, hiring_manager, executive)
 *   2. Tenant-level: user's agencyId must match the ACL policy owner set at upload time
 *
 * Users with agencyId === null (system-level accounts) bypass tenant isolation.
 * Returns 403 if the ACL policy is absent or the user's agency does not match the document owner.
 */
router.get(
  "/storage/objects/*path",
  authMiddleware,
  requireRole("admin", "hr_officer", "hiring_manager", "executive"),
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.path;
      const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
      const objectPath = `/objects/${wildcardPath}`;
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

      // Enforce tenant (agency) isolation via stored ACL metadata
      const aclPolicy = await getObjectAclPolicy(objectFile);
      if (!aclPolicy) {
        // No ACL policy set — fail secure
        res.status(403).json({ error: "Forbidden: document has no access policy" });
        return;
      }

      const user = req.user!;
      const userAgencyId = user.agencyId;

      // System-level accounts (agencyId null) bypass tenant isolation
      if (userAgencyId !== null && aclPolicy.owner !== String(userAgencyId)) {
        res.status(403).json({ error: "Forbidden: document belongs to a different agency" });
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
        req.log.warn({ err: error }, "Object not found");
        res.status(404).json({ error: "Object not found" });
        return;
      }
      req.log.error({ err: error }, "Error serving object");
      res.status(500).json({ error: "Failed to serve object" });
    }
  },
);

export default router;
