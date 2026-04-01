import { Badge } from "@/components/ui/badge";
import { getDocumentStatus, getStatusLabel, type DocumentStatus } from "@/lib/document-status";
import { cn } from "@/lib/utils";

const statusStyles: Record<DocumentStatus, string> = {
  valid: "bg-success text-success-foreground hover:bg-success/80",
  expiring_soon: "bg-warning text-warning-foreground hover:bg-warning/80",
  expired: "bg-destructive text-destructive-foreground hover:bg-destructive/80",
};

export function StatusBadge({ expiryDate }: { expiryDate: string | null | undefined }) {
  const status = getDocumentStatus(expiryDate);
  return (
    <Badge className={cn("font-medium", statusStyles[status])}>
      {getStatusLabel(status)}
    </Badge>
  );
}
