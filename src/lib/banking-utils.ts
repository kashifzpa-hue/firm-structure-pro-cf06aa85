import { supabase } from "@/integrations/supabase/client";

export const UAE_BANKS = [
  "Emirates NBD",
  "Abu Dhabi Commercial Bank (ADCB)",
  "First Abu Dhabi Bank (FAB)",
  "Dubai Islamic Bank (DIB)",
  "Mashreq Bank",
  "Abu Dhabi Islamic Bank (ADIB)",
  "Sharjah Islamic Bank (SIB)",
  "Commercial Bank of Dubai (CBD)",
  "Citibank UAE",
  "HSBC UAE",
  "Standard Chartered UAE",
  "Barclays UAE",
  "Other",
] as const;

export const ACCOUNT_TYPES = [
  { value: "current", label: "Current" },
  { value: "savings", label: "Savings" },
  { value: "call_deposit", label: "Call Deposit" },
  { value: "trade_finance", label: "Trade Finance" },
] as const;

export const ACCOUNT_STATUSES = [
  { value: "active", label: "Active" },
  { value: "dormant", label: "Dormant" },
  { value: "closed", label: "Closed" },
] as const;

export const SIGNATORY_STATUSES = [
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "revoked", label: "Revoked" },
] as const;

export const AUTHORITY_OPTIONS = [
  { value: "payments", label: "Payments" },
  { value: "cheques", label: "Cheque Signing" },
  { value: "trade_finance", label: "Trade Finance" },
  { value: "fx", label: "FX Transactions" },
  { value: "online_admin", label: "Online Banking Administration" },
  { value: "all", label: "All" },
] as const;

export const BANK_DOC_TYPES = [
  "Account Opening Letter",
  "Board Resolution for Signatories",
  "Bank Mandate Form",
  "Correspondence",
  "Other",
] as const;

export const RULE_TYPES = [
  { value: "solo", label: "Solo", desc: "One person from a group can authorize alone" },
  { value: "joint_same_group", label: "Joint — Same Group", desc: "Multiple persons from the same group required" },
  { value: "joint_cross_group", label: "Joint — Cross Group", desc: "Persons from different groups required together" },
] as const;

export function maskAccountNumber(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 4) return value;
  return "••••" + value.slice(-4);
}

export function maskIban(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 4) return value;
  return "••••" + value.slice(-4);
}

export function formatLimit(amount: number | null | undefined, currency: string = "AED"): string {
  if (amount === null || amount === undefined) return "Unlimited";
  return `${currency} ${amount.toLocaleString()}`;
}

export function getAuthorityLabels(values: string[]): string[] {
  if (values.includes("all")) return ["All"];
  return values.map(v => AUTHORITY_OPTIONS.find(o => o.value === v)?.label || v);
}

export async function logBankingActivity(
  bankAccountId: string,
  actionType: string,
  details: string,
  doneBy: string,
  workspaceId: string
) {
  await supabase.from("banking_activity_log").insert({
    bank_account_id: bankAccountId,
    action_type: actionType,
    details,
    done_by: doneBy,
    workspace_id: workspaceId,
  } as any);
}
