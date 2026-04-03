import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { pdf } from "@react-pdf/renderer";
import { Document, Page, pdfjs } from "react-pdf";
import { Download, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import React, { useState, useEffect, useCallback } from "react";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface PdfPreviewModalProps {
  open: boolean;
  onClose: () => void;
  document: React.ReactElement;
  filename: string;
}

export function PdfPreviewModal({ open, onClose, document: pdfDoc, filename }: PdfPreviewModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [loading, setLoading] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!open) {
      setPdfData(null);
      setCurrentPage(1);
      setNumPages(0);
      return;
    }

    let cancelled = false;
    setLoading(true);

    pdf(pdfDoc)
      .toBlob()
      .then((blob) => blob.arrayBuffer())
      .then((buffer) => {
        if (cancelled) return;
        setPdfData(new Uint8Array(buffer));
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to generate preview");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, pdfDoc]);

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setCurrentPage(1);
  }, []);

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
            <div className="flex items-center gap-2">
              {numPages > 1 && (
                <div className="flex items-center gap-1 text-sm font-normal">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[60px] text-center">
                    {currentPage} / {numPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={currentPage >= numPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
              <Button onClick={handleDownload} disabled={downloading} size="sm">
                <Download className="mr-2 h-4 w-4" />
                {downloading ? "Downloading..." : "Download PDF"}
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-auto flex justify-center bg-muted/50 rounded">
          {loading ? (
            <div className="flex items-center justify-center h-full w-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Generating preview…</span>
            </div>
          ) : pdfData ? (
            <Document
              file={{ data: pdfData }}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center h-full w-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <Page
                pageNumber={currentPage}
                width={700}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
          ) : (
            <div className="flex items-center justify-center h-full w-full text-muted-foreground">
              Preview unavailable — use Download PDF instead.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
