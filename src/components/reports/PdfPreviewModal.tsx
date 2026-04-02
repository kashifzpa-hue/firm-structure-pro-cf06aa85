import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import { Download } from "lucide-react";
import { toast } from "sonner";
import React, { useState } from "react";

interface PdfPreviewModalProps {
  open: boolean;
  onClose: () => void;
  document: React.ReactElement;
  filename: string;
}

export function PdfPreviewModal({ open, onClose, document, filename }: PdfPreviewModalProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await pdf(document).toBlob();
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
          <PDFViewer width="100%" height="100%" showToolbar={false}>
            {document}
          </PDFViewer>
        </div>
      </DialogContent>
    </Dialog>
  );
}
