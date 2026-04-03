import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { pdf } from "@react-pdf/renderer";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import React, { useState, useEffect, useRef } from "react";

interface PdfPreviewModalProps {
  open: boolean;
  onClose: () => void;
  document: React.ReactElement;
  filename: string;
}

export function PdfPreviewModal({ open, onClose, document: pdfDoc, filename }: PdfPreviewModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
        setPreviewUrl(null);
      }
      return;
    }

    let cancelled = false;
    setLoading(true);

    pdf(pdfDoc)
      .toBlob()
      .then((blob) => {
        if (cancelled) return;
        // Ensure the blob has the correct PDF MIME type
        const pdfBlob = new Blob([blob], { type: "application/pdf" });
        const url = URL.createObjectURL(pdfBlob);
        urlRef.current = url;
        setPreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to generate preview");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, pdfDoc]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await pdf(pdfDoc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = filename;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Report downloaded successfully");
    } catch (e) {
      toast.error("Failed to download report");
    }
    setDownloading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[70vw] h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Report Preview</span>
            <Button onClick={handleDownload} disabled={downloading} size="sm">
              <Download className="mr-2 h-4 w-4" />
              {downloading ? "Downloading..." : "Download PDF"}
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Generating preview…</span>
            </div>
          ) : previewUrl ? (
            <object
              data={`${previewUrl}#toolbar=1&navpanes=0`}
              type="application/pdf"
              className="w-full h-full rounded"
            >
              <iframe
                src={`${previewUrl}#toolbar=1`}
                className="w-full h-full border-0 rounded"
                title="PDF Preview"
              />
            </object>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Preview unavailable — use Download PDF instead.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
