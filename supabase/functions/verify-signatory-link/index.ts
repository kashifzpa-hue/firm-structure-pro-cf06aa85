// Verifies whether a (possibly tokenized) person is a signatory on a specific
// bank account, and whether they appear in that account's signing rules.
// Returns the exact rows matched plus a checklist of what was queried, so
// "no link exists" is never confused with "data not accessible".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsFor } from "../_shared/http.ts";
import { createTokenizer } from "../_shared/pii-tokens.ts";

type Check = { dataset: string; queried: boolean; rows: number; error?: string };

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, corsHeaders);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
        auth: { persistSession: false },
      },
    );

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Not authenticated" }, 401, corsHeaders);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, corsHeaders);
    }

    const person = typeof body.person === "string" ? body.person.trim() : "";
    const account = typeof body.bank_account === "string" ? body.bank_account.trim() : "";
    const ruleFilter = typeof body.signing_rule === "string" ? body.signing_rule.trim() : "";
    const includeInactive = body.include_inactive === true;

    if (!person || !account) {
      return json(
        { error: "Both 'person' and 'bank_account' are required. Each accepts an id, a name/number, or a [PERSON_x]/[ACCOUNT_x] token." },
        400,
        corsHeaders,
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("workspace_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const workspaceId = profile?.workspace_id as string | undefined;
    if (!workspaceId) return json({ error: "No workspace for this user" }, 403, corsHeaders);

    const checks: Check[] = [];
    const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
    const isToken = (v: string) => /^\[[A-Z_]+_[A-Z2-7]+\]$/.test(v);

    // ---- Resolve the person -------------------------------------------------
    const { data: people, error: peopleError } = await supabase
      .from("entities")
      .select("id, name, type")
      .eq("workspace_id", workspaceId)
      .eq("type", "person")
      .limit(5000);
    checks.push({
      dataset: "entities (persons)",
      queried: true,
      rows: people?.length ?? 0,
      error: peopleError?.message,
    });
    if (peopleError) {
      return json({ verdict: "not_accessible", reason: "Could not read the entity register.", checks }, 200, corsHeaders);
    }

    let personRow = (people ?? []).find(
      (p) => p.id === person || (p.name as string)?.toLowerCase() === person.toLowerCase(),
    );

    if (!personRow && isToken(person)) {
      // Tokens are deterministic per workspace — re-tokenize each name to match.
      const tokenizer = await createTokenizer(
        Deno.env.get("ENCRYPTION_MASTER_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
        workspaceId,
      );
      for (const p of people ?? []) {
        if ((await tokenizer.tokenize("PERSON", p.name as string)) === person) {
          personRow = p;
          break;
        }
      }
    }

    if (!personRow) {
      return json(
        {
          verdict: "person_not_found",
          reason: isUuid(person) || isToken(person)
            ? "No person in this workspace matches that identifier."
            : "No person in this workspace matches that name.",
          checks,
        },
        200,
        corsHeaders,
      );
    }

    // ---- Resolve the bank account ------------------------------------------
    const { data: accounts, error: accError } = await supabase
      .from("bank_accounts")
      .select("id, bank_name, bank_name_custom, account_number, iban, currency, account_status, company_entity_id, cif_id")
      .eq("workspace_id", workspaceId)
      .limit(2000);
    checks.push({ dataset: "bank_accounts", queried: true, rows: accounts?.length ?? 0, error: accError?.message });
    if (accError) {
      return json({ verdict: "not_accessible", reason: "Could not read bank accounts.", checks }, 200, corsHeaders);
    }

    const needle = account.toLowerCase();
    const accountRow = (accounts ?? []).find(
      (a) =>
        a.id === account ||
        (a.account_number as string)?.toLowerCase() === needle ||
        (a.iban as string)?.toLowerCase() === needle ||
        (a.account_number as string)?.toLowerCase().endsWith(needle),
    );

    if (!accountRow) {
      return json(
        { verdict: "account_not_found", reason: "No bank account in this workspace matches that identifier.", checks },
        200,
        corsHeaders,
      );
    }

    // ---- Signatory links ----------------------------------------------------
    let sigQuery = supabase
      .from("signatories")
      .select(
        "id, person_entity_id, bank_account_id, signatory_group_id, title, designation, authorised_for, individual_limit, individual_limit_currency, effective_date, expiry_date, status, board_resolution_ref, bank_acknowledged_date",
      )
      .eq("workspace_id", workspaceId)
      .eq("bank_account_id", accountRow.id)
      .eq("person_entity_id", personRow.id);
    if (!includeInactive) sigQuery = sigQuery.eq("status", "active");

    const { data: signatories, error: sigError } = await sigQuery;
    checks.push({ dataset: "signatories", queried: true, rows: signatories?.length ?? 0, error: sigError?.message });
    if (sigError) {
      return json({ verdict: "not_accessible", reason: "Could not read signatory records.", checks }, 200, corsHeaders);
    }

    // ---- Groups + signing rules for the account -----------------------------
    const { data: groups, error: groupError } = await supabase
      .from("signatory_groups")
      .select("id, group_label, description, display_order")
      .eq("workspace_id", workspaceId)
      .eq("bank_account_id", accountRow.id);
    checks.push({ dataset: "signatory_groups", queried: true, rows: groups?.length ?? 0, error: groupError?.message });

    const { data: rules, error: ruleError } = await supabase
      .from("signing_matrix_rules")
      .select(
        "id, rule_name, rule_type, group_a_id, min_signatories_from_a, group_b_id, min_signatories_from_b, transaction_limit, daily_limit, limit_currency, applies_to, display_order, notes",
      )
      .eq("workspace_id", workspaceId)
      .eq("bank_account_id", accountRow.id);
    checks.push({ dataset: "signing_matrix_rules", queried: true, rows: rules?.length ?? 0, error: ruleError?.message });

    if (groupError || ruleError) {
      return json(
        { verdict: "not_accessible", reason: "Could not read signing rules or signatory groups.", checks },
        200,
        corsHeaders,
      );
    }

    const personGroupIds = new Set((signatories ?? []).map((s) => s.signatory_group_id).filter(Boolean) as string[]);
    const groupById = new Map((groups ?? []).map((g) => [g.id as string, g]));

    let candidateRules = (rules ?? []).filter(
      (r) =>
        (r.group_a_id && personGroupIds.has(r.group_a_id as string)) ||
        (r.group_b_id && personGroupIds.has(r.group_b_id as string)),
    );

    let ruleRequested: string | null = null;
    if (ruleFilter) {
      ruleRequested = ruleFilter;
      const all = rules ?? [];
      const target = all.filter(
        (r) => r.id === ruleFilter || (r.rule_name as string)?.toLowerCase() === ruleFilter.toLowerCase(),
      );
      if (target.length === 0) {
        return json(
          {
            verdict: "rule_not_found",
            reason: "That signing rule does not exist on this account.",
            account: accountRow,
            person: { id: personRow.id, name: personRow.name },
            available_rules: all.map((r) => ({ id: r.id, rule_name: r.rule_name })),
            checks,
          },
          200,
          corsHeaders,
        );
      }
      candidateRules = candidateRules.filter((r) => target.some((t) => t.id === r.id));
      if (candidateRules.length === 0) {
        // The rule exists but the person's groups don't participate in it.
        candidateRules = [];
      }
    }

    const linked = (signatories ?? []).length > 0;
    const ruleLinked = candidateRules.length > 0;

    const verdict = !linked
      ? "no_link"
      : ruleFilter
        ? ruleLinked
          ? "linked"
          : "linked_but_not_in_rule"
        : "linked";

    const reason = {
      no_link: `No signatory record links this person to this bank account${includeInactive ? "" : " with active status"}. The check completed successfully — the link genuinely does not exist.`,
      linked: "The person is a signatory on this account and the matched rows are returned below.",
      linked_but_not_in_rule:
        "The person is a signatory on this account, but their signatory group does not participate in the requested signing rule.",
    }[verdict as "no_link" | "linked" | "linked_but_not_in_rule"];

    return json(
      {
        verdict,
        reason,
        person: { id: personRow.id, name: personRow.name },
        bank_account: accountRow,
        rule_requested: ruleRequested,
        matched: {
          signatories: signatories ?? [],
          signatory_groups: [...personGroupIds].map((id) => groupById.get(id)).filter(Boolean),
          signing_rules: candidateRules,
        },
        all_account_rules: rules ?? [],
        checks,
      },
      200,
      corsHeaders,
    );
  } catch (err) {
    console.error("[verify-signatory-link]", err);
    return json({ error: "Unexpected error", detail: String(err) }, 500, corsFor(req));
  }
});
