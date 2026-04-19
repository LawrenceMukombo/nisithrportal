import { useEffect, useState } from "react";
import { Loader2, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getToken } from "@/lib/api-config";

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title: string;
  downloadFilename: string;
}

export function PdfPreviewDialog({
  open,
  onOpenChange,
  url,
  title,
  downloadFilename,
}: PdfPreviewDialogProps) {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let createdUrl: string | null = null;

    setLoading(true);
    setError(null);
    setPdfBlobUrl(null);

    (async () => {
      try {
        const token = getToken();
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? "Failed to load PDF preview");
        }
        const blob = await res.blob();
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(createdUrl);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load PDF preview");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [open, url]);

  function handleDownload() {
    if (!pdfBlobUrl) return;
    const a = document.createElement("a");
    a.href = pdfBlobUrl;
    a.download = downloadFilename;
    a.click();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 pr-14">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle data-testid="text-pdf-preview-title">{title}</DialogTitle>
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={!pdfBlobUrl || loading}
              data-testid="button-download-pdf-preview"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" /> Download
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-hidden border-t bg-muted/30">
          {loading && (
            <div
              className="h-full flex items-center justify-center text-muted-foreground"
              data-testid="pdf-preview-loading"
            >
              <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Generating preview…
            </div>
          )}
          {error && !loading && (
            <div
              className="h-full flex items-center justify-center text-destructive p-6 text-center"
              data-testid="pdf-preview-error"
            >
              {error}
            </div>
          )}
          {pdfBlobUrl && !loading && !error && (
            <iframe
              src={pdfBlobUrl}
              title={title}
              className="w-full h-full"
              data-testid="iframe-pdf-preview"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
