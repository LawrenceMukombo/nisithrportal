import { eq } from "drizzle-orm";
import { db, candidatesTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";

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
// SSRF protection
// ---------------------------------------------------------------------------

/** IPv4 CIDR-style prefix blocks for private/link-local ranges. */
const PRIVATE_IPV4_PREFIXES = [
  "10.",
  "172.16.", "172.17.", "172.18.", "172.19.", "172.20.",
  "172.21.", "172.22.", "172.23.", "172.24.", "172.25.",
  "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.",
  "192.168.",
  "169.254.", // link-local / AWS metadata
  "127.",     // loopback
];

/** Known cloud metadata IP. */
const METADATA_IP = "169.254.169.254";

/**
 * Validate that a URL is safe to fetch server-side.
 * Enforces: HTTPS-only, no private/loopback/link-local hosts.
 * Throws a descriptive error on violations.
 */
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

  // Block loopback / well-known internal hostnames
  const blockedHosts = ["localhost", "127.0.0.1", "::1", "0.0.0.0", METADATA_IP];
  if (blockedHosts.includes(host)) {
    throw new Error(`cvUrl hostname '${host}' is not permitted`);
  }

  // Block *.local and *.internal patterns
  if (host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".localhost")) {
    throw new Error(`cvUrl hostname '${host}' is not permitted`);
  }

  // If hostname looks like a bare IPv4 address, block private ranges
  const ipv4Re = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  if (ipv4Re.test(host)) {
    for (const prefix of PRIVATE_IPV4_PREFIXES) {
      if (host.startsWith(prefix)) {
        throw new Error(`cvUrl resolves to a private network address`);
      }
    }
  }

  // Block known GCP metadata endpoint
  if (host === "metadata.google.internal") {
    throw new Error(`cvUrl hostname '${host}' is not permitted`);
  }
}

// ---------------------------------------------------------------------------
// PDF extraction via pdfjs-dist
// ---------------------------------------------------------------------------

const MAX_CV_BYTES = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 15_000;

/**
 * Extract plain text from a PDF buffer using pdfjs-dist.
 * Iterates all pages and concatenates their text content.
 */
async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    parts.push(pageText);
  }
  await doc.destroy();
  return parts.join("\n").trim();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Download a document from a public HTTPS URL and extract its text content.
 * Supports PDF (via pdfjs-dist) and plain text files.
 *
 * Enforces strict SSRF safeguards:
 *   - HTTPS-only
 *   - Private/loopback/link-local IP ranges are blocked
 *   - 15-second fetch timeout
 *   - 10 MB response size cap
 *
 * Throws on validation failure, unreachable URLs, or unsupported content.
 */
export async function extractTextFromUrl(url: string): Promise<string> {
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

  // Enforce max response size via streaming read
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
        throw new Error(`CV file exceeds maximum allowed size of ${MAX_CV_BYTES / 1024 / 1024} MB`);
      }
      chunks.push(value);
    }
  }

  const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/pdf") || url.toLowerCase().endsWith(".pdf")) {
    return extractPdfText(buffer.buffer as ArrayBuffer);
  }

  return buffer.toString("utf-8").trim();
}

/**
 * Fire-and-forget background CV parse.
 *
 * Priority: cvUrl (download actual CV doc) → fallbackText (e.g. cover letter stub).
 * Always re-parses when cvUrl is provided (catches returning candidates uploading
 * a new CV), falls back to text when no URL is available and no data yet exists.
 */
export async function autoParseCvBackground(
  candidateId: number,
  opts: { cvUrl?: string | null; fallbackText?: string | null; forceReparse?: boolean }
): Promise<void> {
  try {
    let text: string | null = null;

    if (opts.cvUrl) {
      try {
        text = await extractTextFromUrl(opts.cvUrl);
      } catch (err) {
        console.warn(`[cvParser] Could not extract text from cvUrl, will use fallback: ${String(err)}`);
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
