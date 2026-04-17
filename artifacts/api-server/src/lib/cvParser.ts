import mammoth from "mammoth";
import { eq } from "drizzle-orm";
import { db, candidatesTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ObjectStorageService } from "./objectStorage.js";

// Polyfill browser globals required by pdfjs-dist when running in Node.js.
// These are only needed for rendering; for text extraction they act as stubs.
const g = globalThis as Record<string, unknown>;
if (typeof g["DOMMatrix"] === "undefined") {
  g["DOMMatrix"] = class DOMMatrix { static fromMatrix() { return new (g["DOMMatrix"] as new () => object)(); } };
}
if (typeof g["ImageData"] === "undefined") {
  g["ImageData"] = class ImageData {};
}
if (typeof g["Path2D"] === "undefined") {
  g["Path2D"] = class Path2D {};
}

// ---------------------------------------------------------------------------
// SSRF protection (applied to external/absolute URLs only)
// ---------------------------------------------------------------------------

/** IPv4 prefix blocks for private/link-local ranges. */
const PRIVATE_IPV4_PREFIXES = [
  "10.",
  "172.16.", "172.17.", "172.18.", "172.19.", "172.20.",
  "172.21.", "172.22.", "172.23.", "172.24.", "172.25.",
  "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.",
  "192.168.",
  "169.254.", // link-local / AWS/GCP metadata IMDS
  "127.",     // loopback
];

function assertSafeCvUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("cvUrl is not a valid URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("cvUrl must use HTTPS");
  }

  const host = parsed.hostname.toLowerCase();

  const blockedHosts = ["localhost", "127.0.0.1", "::1", "0.0.0.0", "169.254.169.254"];
  if (blockedHosts.includes(host)) {
    throw new Error(`cvUrl hostname '${host}' is not permitted`);
  }

  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) {
    throw new Error(`cvUrl hostname '${host}' is not permitted`);
  }

  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
    for (const prefix of PRIVATE_IPV4_PREFIXES) {
      if (host.startsWith(prefix)) {
        throw new Error("cvUrl resolves to a private network address");
      }
    }
  }

  if (host === "metadata.google.internal") {
    throw new Error(`cvUrl hostname '${host}' is not permitted`);
  }
}

// ---------------------------------------------------------------------------
// File-type text extraction helpers
// ---------------------------------------------------------------------------

/** Extract plain text from a PDF buffer using pdfjs-dist. */
async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    parts.push(pageText);
  }
  await doc.destroy();
  return parts.join("\n").trim();
}

/** Extract plain text from a DOCX buffer using mammoth. */
async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
  return value.trim();
}

/** Determine text from a buffer given content-type and URL hint. */
async function bufferToText(buffer: ArrayBuffer, contentType: string, urlHint: string): Promise<string> {
  const isPdf = contentType.includes("application/pdf") || urlHint.toLowerCase().endsWith(".pdf");
  const isDocx =
    contentType.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document") ||
    urlHint.toLowerCase().endsWith(".docx");

  if (isPdf) return extractPdfText(buffer);
  if (isDocx) return extractDocxText(buffer);
  return Buffer.from(buffer).toString("utf-8").trim();
}

// ---------------------------------------------------------------------------
// Storage path reader (trusted internal path, no HTTP / no SSRF risk)
// ---------------------------------------------------------------------------

const PRIVATE_STORAGE_PREFIX = "/api/storage/objects/";
const PUBLIC_STORAGE_PREFIX = "/api/storage/public-objects/";

async function readStoragePath(
  storagePath: string
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const svc = new ObjectStorageService();

  if (storagePath.startsWith(PRIVATE_STORAGE_PREFIX)) {
    const entityId = storagePath.slice(PRIVATE_STORAGE_PREFIX.length);
    const objectPath = `/objects/${entityId}`;
    const file = await svc.getObjectEntityFile(objectPath);
    const response = await svc.downloadObject(file);
    return {
      buffer: await response.arrayBuffer(),
      contentType: response.headers.get("content-type") ?? "",
    };
  }

  if (storagePath.startsWith(PUBLIC_STORAGE_PREFIX)) {
    const filePath = storagePath.slice(PUBLIC_STORAGE_PREFIX.length);
    const file = await svc.searchPublicObject(filePath);
    if (!file) throw new Error(`Public storage object not found: ${filePath}`);
    const response = await svc.downloadObject(file);
    return {
      buffer: await response.arrayBuffer(),
      contentType: response.headers.get("content-type") ?? "",
    };
  }

  throw new Error(`Unrecognised internal storage path: ${storagePath}`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const MAX_CV_BYTES = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Extract text from a CV document URL.
 *
 * Two modes:
 * 1. Internal storage paths (`/api/storage/...`) → read directly from GCS
 *    via ObjectStorageService; no HTTP round-trip and no SSRF risk.
 * 2. Absolute external URLs → SSRF-validated HTTPS fetch with timeout and
 *    10 MB response size cap.
 *
 * Supports PDF, DOCX, and plain-text content.
 */
export async function extractTextFromUrl(url: string): Promise<string> {
  let buffer: ArrayBuffer;
  let contentType: string;

  if (url.startsWith("/api/storage/")) {
    // Trusted internal storage path — read directly, no SSRF risk.
    const result = await readStoragePath(url);
    buffer = result.buffer;
    contentType = result.contentType;
  } else {
    // External URL — validate and fetch with SSRF protection.
    assertSafeCvUrl(url);

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch CV from URL (HTTP ${response.status}): ${url}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body for CV URL");

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > MAX_CV_BYTES) {
          await reader.cancel();
          throw new Error(`CV file exceeds ${MAX_CV_BYTES / 1024 / 1024} MB limit`);
        }
        chunks.push(value);
      }
    }

    buffer = Buffer.concat(chunks.map((c) => Buffer.from(c))).buffer as ArrayBuffer;
    contentType = response.headers.get("content-type") ?? "";
  }

  return bufferToText(buffer, contentType, url);
}

/**
 * Fire-and-forget background CV parse.
 *
 * Always re-parses when cvUrl is provided (so returning candidates uploading
 * a new CV document get fresh parsed data). Falls back to fallbackText when
 * no cvUrl is given and the candidate has no parsed data yet.
 */
export async function autoParseCvBackground(
  candidateId: number,
  opts: { cvUrl?: string | null; fallbackText?: string | null }
): Promise<void> {
  try {
    let text: string | null = null;

    if (opts.cvUrl) {
      try {
        text = await extractTextFromUrl(opts.cvUrl);
      } catch (err) {
        console.warn(`[cvParser] Could not extract text from cvUrl, falling back: ${String(err)}`);
      }
    }

    if (!text && opts.fallbackText) {
      text = opts.fallbackText;
    }

    if (!text) {
      console.warn("[cvParser] No text source available for auto CV parse, skipping");
      return;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 4096,
      messages: [
        {
          role: "system",
          content: "You are an expert CV parser. Extract structured information from the provided text. Return JSON only.",
        },
        {
          role: "user",
          content: `Parse the following CV text and extract candidate information. Return JSON with fields: name (string|null), email (string|null), phone (string|null), skills (string[]), experience (string[]), education (string[]), summary (string|null).\n\nText:\n${text}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return;
    const parsedData = JSON.parse(content) as Record<string, unknown>;
    await db.update(candidatesTable).set({ parsedData }).where(eq(candidatesTable.id, candidateId));
  } catch (err) {
    console.error("[cvParser] Auto CV parse failed:", err);
  }
}
