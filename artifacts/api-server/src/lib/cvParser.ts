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

/**
 * Download a file from a public URL and extract its text content.
 * Supports PDF (via pdfjs-dist) and plain text files.
 * Throws if the URL is unreachable or the content type is unsupported.
 */
export async function extractTextFromUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch CV from URL (HTTP ${response.status}): ${url}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  const buffer = await response.arrayBuffer();

  if (contentType.includes("application/pdf") || url.toLowerCase().endsWith(".pdf")) {
    return extractPdfText(buffer);
  }

  return Buffer.from(buffer).toString("utf-8").trim();
}

/**
 * Fire-and-forget background CV parse.
 * Priority: cvUrl (download actual CV doc) → fallback text (e.g. cover letter stub).
 * Only runs when the candidate has no parsedData yet.
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
