import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regression tests: AI Search must actually call the banking/signatory tools
 * before it is allowed to conclude that signatory links are unavailable.
 *
 * The edge function runs on Deno, so these tests assert on its source contract
 * (tool registry, tables queried, and the negative-answer prompt rules) plus the
 * UI checklist that surfaces which datasets were queried.
 */

const assistantSrc = readFileSync(
  resolve(process.cwd(), "supabase/functions/ai-assistant/index.ts"),
  "utf8",
);
const checklistSrc = readFileSync(
  resolve(process.cwd(), "src/components/ai-elements/message-checklist.tsx"),
  "utf8",
);

const SIGNATORY_TOOLS = [
  "list_bank_relationships",
  "list_bank_accounts",
  "list_signatories",
  "list_signing_rules",
  "list_bank_facilities",
  "list_credit_limits",
  "list_bank_service_requests",
  "list_appointments",
] as const;

const TOOL_TABLES: Record<string, string[]> = {
  list_bank_relationships: ["bank_relationships"],
  list_bank_accounts: ["bank_accounts"],
  list_signatories: ["signatories"],
  list_signing_rules: ["signing_matrix_rules", "signatory_groups"],
  list_bank_facilities: ["bank_facilities"],
  list_credit_limits: ["bank_credit_limits"],
  list_bank_service_requests: ["bank_service_requests"],
  list_appointments: ["appointments"],
};

describe("AI Search signatory tool registry", () => {
  it.each(SIGNATORY_TOOLS)("registers the %s tool", (name) => {
    expect(assistantSrc).toContain(`${name}: tool({`);
  });

  it.each(Object.entries(TOOL_TABLES))("%s queries its backing table(s)", (name, tables) => {
    const start = assistantSrc.indexOf(`${name}: tool({`);
    expect(start).toBeGreaterThan(-1);
    const next = SIGNATORY_TOOLS.map((t) => assistantSrc.indexOf(`${t}: tool({`, start + 1))
      .filter((i) => i > start)
      .sort((a, b) => a - b)[0];
    const body = assistantSrc.slice(start, next === undefined ? start + 4000 : next);
    for (const table of tables) {
      expect(body).toContain(`.from("${table}")`);
    }
  });

  it("lets list_signatories be filtered by person without an account filter", () => {
    const start = assistantSrc.indexOf("list_signatories: tool({");
    const body = assistantSrc.slice(start, start + 2000);
    expect(body).toMatch(/person_entity_id/);
    expect(body).toMatch(/bank_account_id/);
  });

  it("returns a count on signatory results so empty vs. inaccessible is distinguishable", () => {
    const start = assistantSrc.indexOf("list_signatories: tool({");
    const body = assistantSrc.slice(start, start + 2000);
    expect(body).toMatch(/count:\s*data\?\.length\s*\?\?\s*0/);
  });
});

describe("AI Search negative-answer prompt rules", () => {
  it("instructs the model to call the relevant tool before saying data is unavailable", () => {
    expect(assistantSrc).toMatch(/Before saying data is unavailable, call the relevant tool/i);
  });

  it("names the banking tools in the system prompt", () => {
    for (const name of SIGNATORY_TOOLS) {
      expect(assistantSrc.slice(0, assistantSrc.indexOf("list_entities: tool({"))).toContain(name);
    }
  });

  it("separates 'no links exist' from 'data not accessible'", () => {
    expect(assistantSrc).toContain("NO LINKS EXIST");
    expect(assistantSrc).toContain("DATA NOT ACCESSIBLE");
    expect(assistantSrc).toMatch(/returned zero matching rows/i);
    expect(assistantSrc).toMatch(/never phrase it as if the records do not exist/i);
  });

  it("tells the model to check signatories for a person across all accounts", () => {
    expect(assistantSrc).toMatch(
      /call list_signatories with that person's id and no account filter/i,
    );
  });
});

describe("AI Search 'what I checked' checklist", () => {
  it.each(SIGNATORY_TOOLS)("labels %s in the checklist", (name) => {
    expect(checklistSrc).toContain(`${name}:`);
  });

  it("marks zero-row results as empty rather than as an error", () => {
    expect(checklistSrc).toContain('state = "empty"');
    expect(checklistSrc).toContain("no matching records");
    expect(checklistSrc).toContain('state = "error"');
  });
});
