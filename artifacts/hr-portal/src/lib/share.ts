export type ShareJobOptions = {
  url: string;
  title?: string;
  text?: string;
};

export type ShareJobResult = "shared" | "copied" | "cancelled" | "error";

function canUseNativeShare(): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.share !== "function") return false;
  return true;
}

export async function shareJob(opts: ShareJobOptions): Promise<ShareJobResult> {
  const { url, title, text } = opts;
  if (canUseNativeShare()) {
    try {
      await navigator.share({ url, title, text });
      return "shared";
    } catch (err) {
      const e = err as { name?: string };
      if (e?.name === "AbortError") {
        return "cancelled";
      }
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "error";
  }
}
