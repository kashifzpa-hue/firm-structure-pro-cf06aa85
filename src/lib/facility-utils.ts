export const FACILITY_TYPES = [
  { value: "internet_banking", label: "Internet Banking Access" },
  { value: "sweep", label: "Sweep / Auto-Sweep" },
  { value: "statement_delivery", label: "Statement Delivery" },
  { value: "cheque_book", label: "Cheque Book" },
  { value: "card", label: "Debit / Credit Card" },
  { value: "standing_instruction", label: "Standing Instruction" },
  { value: "trade_finance", label: "Trade Finance Line" },
  { value: "payroll_wps", label: "Payroll / WPS" },
  { value: "host_to_host", label: "Host-to-Host / API" },
  { value: "other", label: "Other" },
] as const;

export const FACILITY_STATUSES = [
  { value: "requested", label: "Requested" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const ACCESS_LEVELS = [
  { value: "view_only", label: "View Only" },
  { value: "initiator", label: "Initiator" },
  { value: "approver", label: "Approver" },
  { value: "administrator", label: "Administrator" },
] as const;

export const TOKEN_STATUSES = [
  { value: "none", label: "None" },
  { value: "issued", label: "Issued" },
  { value: "lost", label: "Lost" },
  { value: "replaced", label: "Replaced" },
  { value: "returned", label: "Returned" },
] as const;

export const STATEMENT_METHODS = [
  { value: "email", label: "Email" },
  { value: "post", label: "Post" },
  { value: "portal", label: "Portal" },
] as const;

export const STATEMENT_FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annual", label: "Annual" },
] as const;

export const CREDIT_LIMIT_TYPES = [
  { value: "overdraft", label: "Overdraft" },
  { value: "term_loan", label: "Term Loan" },
  { value: "revolving_credit", label: "Revolving Credit" },
  { value: "working_capital", label: "Working Capital" },
  { value: "invoice_discounting", label: "Invoice / Bill Discounting" },
  { value: "lc_sight", label: "Letter of Credit (Sight)" },
  { value: "lc_usance", label: "Letter of Credit (Usance)" },
  { value: "bank_guarantee", label: "Bank Guarantee" },
  { value: "trust_receipt", label: "Trust Receipt" },
  { value: "trade_loan", label: "Trade Loan" },
  { value: "equipment_finance", label: "Equipment / Asset Finance" },
  { value: "credit_card_limit", label: "Credit Card Limit" },
  { value: "other", label: "Other" },
] as const;

export const CREDIT_LIMIT_STATUSES = [
  { value: "proposed", label: "Proposed" },
  { value: "sanctioned", label: "Sanctioned" },
  { value: "active", label: "Active" },
  { value: "under_renewal", label: "Under Renewal" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const REQUEST_TYPES = [
  { value: "new_facility", label: "New Facility" },
  { value: "modify", label: "Modify" },
  { value: "suspend", label: "Suspend" },
  { value: "reactivate", label: "Reactivate" },
  { value: "cancel", label: "Cancel" },
  { value: "access_reset", label: "Access Reset" },
  { value: "limit_change", label: "Limit Change" },
  { value: "limit_renewal", label: "Limit Renewal" },
  { value: "new_cheque_book", label: "New Cheque Book" },
  { value: "token_replacement", label: "Token Replacement" },
  { value: "stop_payment", label: "Stop Payment" },
  { value: "signatory_update", label: "Signatory Update" },
  { value: "other", label: "Other" },
] as const;

export const REQUEST_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const OPEN_REQUEST_STATUSES = ["draft", "submitted", "acknowledged", "in_progress"];

export const REQUEST_DOC_TYPES = [
  "Request Letter",
  "Board Resolution",
  "Bank Acknowledgement",
  "Confirmation",
  "Other",
] as const;

export function labelFor(
  options: readonly { value: string; label: string }[],
  value: string | null | undefined
): string {
  if (!value) return "—";
  return options.find(o => o.value === value)?.label || value;
}

export type DateStatus = "valid" | "expiring" | "expired" | "none";

/** Status of a review/expiry date relative to today, using a warning window in days. */
export function dateStatus(
  date: string | null | undefined,
  warnDays = 60,
  today: Date = new Date()
): DateStatus {
  if (!date) return "none";
  const target = new Date(`${date}T00:00:00`);
  if (Number.isNaN(target.getTime())) return "none";
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((target.getTime() - base.getTime()) / 86400000);
  if (days < 0) return "expired";
  if (days <= warnDays) return "expiring";
  return "valid";
}

export function daysBetween(from: string, to: Date = new Date()): number {
  const start = new Date(`${from}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 0;
  const base = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((base.getTime() - start.getTime()) / 86400000);
}

export function isRequestOverdue(req: {
  status: string;
  expected_completion?: string | null;
}, today: Date = new Date()): boolean {
  if (!OPEN_REQUEST_STATUSES.includes(req.status)) return false;
  if (!req.expected_completion) return false;
  return dateStatus(req.expected_completion, 0, today) === "expired";
}

export interface DualControlIssue {
  kind: "both_roles" | "no_approver";
  personId?: string;
  personName?: string;
  message: string;
}

/** Internal-control checks over the internet banking roster of one account. */
export function dualControlIssues(
  facilities: {
    facility_type: string;
    status: string;
    access_level?: string | null;
    person_entity_id?: string | null;
    person_name?: string | null;
  }[]
): DualControlIssue[] {
  const roster = facilities.filter(
    f => f.facility_type === "internet_banking" && f.status === "active"
  );
  const issues: DualControlIssue[] = [];

  const byPerson = new Map<string, { name: string; roles: Set<string> }>();
  roster.forEach(f => {
    if (!f.person_entity_id) return;
    const entry = byPerson.get(f.person_entity_id) || {
      name: f.person_name || "Unknown",
      roles: new Set<string>(),
    };
    if (f.access_level) entry.roles.add(f.access_level);
    byPerson.set(f.person_entity_id, entry);
  });

  byPerson.forEach((entry, personId) => {
    const both =
      entry.roles.has("initiator") &&
      (entry.roles.has("approver") || entry.roles.has("administrator"));
    if (both) {
      issues.push({
        kind: "both_roles",
        personId,
        personName: entry.name,
        message: `${entry.name} is both an Initiator and an Approver on this account`,
      });
    }
  });

  const hasInitiator = roster.some(f => f.access_level === "initiator");
  const hasApprover = roster.some(
    f => f.access_level === "approver" || f.access_level === "administrator"
  );
  if (hasInitiator && !hasApprover) {
    issues.push({
      kind: "no_approver",
      message: "This account has an Initiator but no Approver",
    });
  }

  return issues;
}

export interface LimitTotals {
  currency: string;
  sanctioned: number;
  utilised: number;
  headroom: number;
}

/** Totals sanctioned / utilised / headroom per currency for active limits. */
export function limitTotalsByCurrency(
  limits: {
    currency?: string | null;
    sanctioned_amount?: number | null;
    utilised_amount?: number | null;
    status: string;
  }[]
): LimitTotals[] {
  const map = new Map<string, LimitTotals>();
  limits
    .filter(l => !["cancelled", "expired"].includes(l.status))
    .forEach(l => {
      const currency = l.currency || "AED";
      const row = map.get(currency) || { currency, sanctioned: 0, utilised: 0, headroom: 0 };
      row.sanctioned += Number(l.sanctioned_amount || 0);
      row.utilised += Number(l.utilised_amount || 0);
      row.headroom = row.sanctioned - row.utilised;
      map.set(currency, row);
    });
  return Array.from(map.values()).sort((a, b) => a.currency.localeCompare(b.currency));
}
