import { differenceInDays, parseISO, isValid } from "date-fns";

export type DocumentStatus = "valid" | "expiring_soon" | "expired";

export function getDocumentStatus(expiryDate: string | null | undefined): DocumentStatus {
  if (!expiryDate) return "valid";
  const date = parseISO(expiryDate);
  if (!isValid(date)) return "valid";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilExpiry = differenceInDays(date, today);
  if (daysUntilExpiry < 0) return "expired";
  if (daysUntilExpiry <= 30) return "expiring_soon";
  return "valid";
}

export function getStatusLabel(status: DocumentStatus): string {
  switch (status) {
    case "expired": return "Expired";
    case "expiring_soon": return "Expiring Soon";
    case "valid": return "Valid";
  }
}

export function getStatusVariant(status: DocumentStatus): "destructive" | "warning" | "success" {
  switch (status) {
    case "expired": return "destructive";
    case "expiring_soon": return "warning";
    case "valid": return "success";
  }
}
