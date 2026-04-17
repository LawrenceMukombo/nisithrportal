import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import multer from "multer";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
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
 * Public multipart file upload endpoint (for unauthenticated applicants submitting CVs).
 * Accepts a single file via multipart/form-data with field name "file".
 * Streams the file server-side to GCS via presigned URL and returns the serving URL.
 *
 * Allowed types: PDF, DOC, DOCX — max 10 MB.
 */
router.post("/upload", (req: Request, res: Response) => {
  upload.single("file")(req, res, async (err) => {
    if (err) {
      const message = err instanceof multer.MulterError
        ? (err.code === "LIMIT_FILE_SIZE" ? "File too large (max 10 MB)" : err.message)
        : (err as Error).message ?? "Invalid file";
      res.status(400).json({ error: message });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": req.file.mimetype },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: req.file.buffer as any,
      });

      if (!uploadRes.ok) {
        req.log.error({ status: uploadRes.status }, "GCS upload failed");
        res.status(500).json({ error: "Failed to store file" });
        return;
      }

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
 * Request a presigned URL for direct client-to-GCS file upload.
 * Requires JWT authentication (for authenticated users such as admins uploading contracts).
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 */
router.post("/storage/uploads/request-url", authMiddleware, async (req: Request, res: Response) => {
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
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
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
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve private object entities (uploaded CVs, contracts, certificates).
 * Restricted to authenticated HR staff roles only (admin, hr_officer, hiring_manager, executive).
 * Applicants and unauthenticated users are denied — uploaded documents are for HR review only.
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

      const response = await objectStorageService.downloadObject(objectFile);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
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
