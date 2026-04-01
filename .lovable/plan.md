

# UBO Edge Case Fixes — Revised Plan

## Summary

Three corrections to the UBO engine: database-level auto-recalculation triggers, workspace-wide unresolved chain detection, and a clean `terminal_entity_id` column for unresolved records.

---

## Step 1: Database Migration

A single migration that:

### 1a. Schema Changes to `ubo_snapshots`
- Add `unresolved_chain BOOLEAN NOT NULL DEFAULT false`
- Add `terminal_entity_id UUID NULLABLE` (references entities.id)
- Make `person_entity_id` nullable (currently NOT NULL — must allow NULL for unresolved records)

### 1b. Update `calculate_ubo` RPC

After the existing person-aggregation INSERT, add unresolved chain detection:

1. From the recursive CTE results, find terminal nodes where `owner_type = 'company'` and that company has NO equity_links pointing into it (no owners)
2. For each such terminal company, find ALL companies in the workspace whose ownership chains pass through it (not just the target company being calculated)
3. Insert unresolved records into `ubo_snapshots` with:
   - `person_entity_id = NULL`
   - `terminal_entity_id = <the ownerless company>`
   - `unresolved_chain = true`
   - `effective_economic_pct = 0`, `effective_voting_pct = 0`
   - Chain showing the path that dead-ends

4. For workspace-wide propagation: query all companies that have ownership paths passing through the terminal company (using a reverse traversal of equity_links downward) and insert unresolved records for each of them too.

### 1c. Auto-Recalculation Trigger Functions

Create a trigger function `trigger_ubo_recalculate()` that calls `calculate_ubo` for the affected company. Then attach triggers:

**On `equity_links`** (AFTER INSERT, UPDATE, DELETE):
- Extract `owned_entity_id` (the company affected)
- Also find all companies below it in the ownership chain (subsidiaries) via a downward traversal
- Call `calculate_ubo` for each affected company

**On `movements`** (AFTER UPDATE — when `confirmed_at` or `voided_at` changes from NULL to non-NULL):
- Extract `company_entity_id`
- Call `calculate_ubo` for that company and its subsidiaries

**On `share_classes`** (AFTER UPDATE — when `voting_rights` changes):
- Extract `company_entity_id`
- Call `calculate_ubo` for that company

All triggers use `SECURITY DEFINER` and handle errors gracefully (log and continue, don't block the triggering operation).

---

## Step 2: Update Frontend — UBO Registry Unresolved Panel

**File: `src/pages/UBORegistry.tsx`**

- Update the "Unresolved Chains" summary card to count `ubo_snapshots` where `unresolved_chain = true` (distinct by `company_entity_id`)
- Add an "Unresolved Chains" panel below the main table listing:
  - Company Name (the company missing UBO resolution)
  - Terminal Entity (the company with no owners — from `terminal_entity_id`)
  - "Fix" button linking to the terminal entity's ownership tab
- Filter unresolved records out of the main UBO table (they have `person_entity_id = NULL`)

**File: `src/components/ubo/CompanyUBOTab.tsx`**

- Query for unresolved snapshots where `company_entity_id` matches AND `unresolved_chain = true`
- Display amber warning if any exist: "Unresolved ownership chain — [Terminal Company] has no owners linked."

---

## Step 3: Update PersonUBOTab for nullable person_entity_id

**File: `src/components/ubo/PersonUBOTab.tsx`** — No changes needed; it already filters by `person_entity_id = personEntityId` which won't match NULL records.

---

## Technical Notes

- The trigger approach means `calculate_ubo` runs inside the same transaction as the equity_link/movement change. For performance, if workspaces grow large, we may need to make triggers async via `pg_notify` + a listener. For now, synchronous is fine given max 10-layer depth and typical workspace sizes.
- The workspace-wide unresolved propagation is handled inside `calculate_ubo` itself, not in the trigger — the trigger just calls `calculate_ubo` for the directly affected company, and the RPC handles finding downstream impacts.

---

## Files Summary

| Action | File |
|--------|------|
| Migration | `ubo_snapshots` schema + updated `calculate_ubo` RPC + 3 trigger functions + 3 triggers |
| Modify | `src/pages/UBORegistry.tsx` — unresolved chains panel using `terminal_entity_id` |
| Modify | `src/components/ubo/CompanyUBOTab.tsx` — unresolved chain warning display |

