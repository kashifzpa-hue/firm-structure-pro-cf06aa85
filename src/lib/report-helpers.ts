import { format, parseISO, isValid, differenceInDays } from "date-fns";

export function formatReportDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "[Not recorded]";
  const d = parseISO(dateStr);
  if (!isValid(d)) return "[Not recorded]";
  return format(d, "dd MMM yyyy");
}

export function formatDateTime(date: Date): string {
  return format(date, "dd MMM yyyy 'at' HH:mm");
}

export function formatDateForFilename(date: Date): string {
  return format(date, "yyyyMMdd");
}

export function getDocStatusLabel(expiryDate: string | null | undefined): string {
  if (!expiryDate) return "[VALID]";
  const d = parseISO(expiryDate);
  if (!isValid(d)) return "[VALID]";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = differenceInDays(d, today);
  if (diff < 0) return "[EXPIRED]";
  if (diff <= 30) return "[EXPIRING]";
  return "[VALID]";
}

export function getDaysInfo(expiryDate: string | null | undefined): string {
  if (!expiryDate) return "—";
  const d = parseISO(expiryDate);
  if (!isValid(d)) return "—";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = differenceInDays(d, today);
  if (diff < 0) return `${Math.abs(diff)} days overdue`;
  return `${diff} days remaining`;
}

export function buildOwnershipChainLabel(chain: any[]): string {
  if (!chain || chain.length === 0) return "[Not recorded]";
  if (chain.length === 2) return "Direct";
  // Skip last entry (the company itself) and first (the person), show intermediaries
  const intermediaries = chain.slice(1, -1).map((c: any) => c.entity_name);
  return "Via " + intermediaries.join(" → ");
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_");
}
