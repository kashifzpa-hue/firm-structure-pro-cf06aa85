import { supabase } from "@/integrations/supabase/client";
import type { PersonExposure } from "@/lib/offboarding";

export interface PersonExposureFull extends PersonExposure {
  signingRules: Array<{
    id: string;
    rule_name: string;
    rule_type: string;
    transaction_limit: number | null;
    limit_currency: string | null;
    account?: { id: string; bank_name: string; account_number: string } | null;
    group_a?: { group_label: string } | null;
    group_b?: { group_label: string } | null;
  }>;
  serviceRequests: Array<{
    id: string;
    subject: string;
    request_type: string;
    status: string;
    date_requested: string | null;
    bank_reference: string | null;
  }>;
}

/**
 * Everything a person is currently attached to across banking, governance and
 * equity. Used both for the Person Profile report and to generate the
 * offboarding checklist.
 */
export async function fetchPersonExposure(personId: string, workspaceId: string): Promise<PersonExposureFull> {
  const [sigRes, facRes, apptRes, limRes, eqRes, srRes] = await Promise.all([
    supabase
      .from("signatories")
      .select(
        "id, designation, title, authorised_for, individual_limit, individual_limit_currency, effective_date, expiry_date, bank_acknowledged_date, board_resolution_ref, status, bank_account_id, signatory_group_id, account:bank_account_id (id, bank_name, account_number, currency, cif_id), group:signatory_group_id (id, group_label)",
      )
      .eq("workspace_id", workspaceId)
      .eq("person_entity_id", personId)
      .eq("status", "active"),
    supabase
      .from("bank_facilities")
      .select(
        "id, facility_type, status, access_level, token_serial, token_status, cif_id, bank_account_id, statement_recipients, cif:cif_id (id, bank_name, cif_number)",
      )
      .eq("workspace_id", workspaceId)
      .eq("person_entity_id", personId)
      .in("status", ["requested", "active", "suspended"]),
    supabase
      .from("appointments")
      .select("id, role_title, role_category, appointment_date, company:company_entity_id (id, name)")
      .eq("workspace_id", workspaceId)
      .eq("person_entity_id", personId)
      .is("resignation_date", null),
    supabase
      .from("bank_credit_limits")
      .select("id, limit_type, status, sanctioned_amount, currency, expiry_date, cif:cif_id (id, bank_name, cif_number)")
      .eq("workspace_id", workspaceId)
      .eq("guarantor_entity_id", personId),
    supabase
      .from("equity_links")
      .select("id, percentage, shares_owned, owned:owned_entity_id (id, name), share_class:share_class_id (class_name)")
      .eq("workspace_id", workspaceId)
      .eq("owner_entity_id", personId)
      .is("end_date", null),
    supabase
      .from("bank_service_requests")
      .select("id, subject, request_type, status, date_requested, bank_reference, signatory_id")
      .eq("workspace_id", workspaceId)
      .not("status", "in", "(completed,cancelled,rejected)"),
  ]);

  const signatories = (sigRes.data ?? []) as any[];
  const groupIds = signatories.map((s) => s.signatory_group_id).filter(Boolean);
  const accountIds = signatories.map((s) => s.bank_account_id).filter(Boolean);

  let signingRules: PersonExposureFull["signingRules"] = [];
  if (accountIds.length > 0) {
    const { data } = await supabase
      .from("signing_matrix_rules")
      .select(
        "id, rule_name, rule_type, transaction_limit, limit_currency, group_a_id, group_b_id, account:bank_account_id (id, bank_name, account_number), group_a:group_a_id (group_label), group_b:group_b_id (group_label)",
      )
      .eq("workspace_id", workspaceId)
      .in("bank_account_id", accountIds);
    signingRules = ((data ?? []) as any[]).filter(
      (r) => groupIds.length === 0 || groupIds.includes(r.group_a_id) || groupIds.includes(r.group_b_id),
    );
  }

  const sigIds = new Set(signatories.map((s) => s.id));
  const serviceRequests = ((srRes.data ?? []) as any[]).filter((r) => r.signatory_id && sigIds.has(r.signatory_id));

  return {
    signatories,
    facilities: (facRes.data ?? []) as any[],
    appointments: (apptRes.data ?? []) as any[],
    guarantees: (limRes.data ?? []) as any[],
    shareholdings: (eqRes.data ?? []) as any[],
    signingRules,
    serviceRequests,
  };
}
