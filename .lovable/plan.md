

# Pre-Cleanup Fixes & Database Reset Plan

## Overview
Four code/database changes before test execution: fix CAPITAL_DECREASE RPC for unallocated shares, update UI error messages, void/delete movements to reset state, activate Co B.

## 1. Fix `confirm_movement` RPC — CAPITAL_DECREASE unallocated support

**Migration SQL** updates the CAPITAL_DECREASE branch:

```text
When from_entity_id IS NULL:
  1. Calculate v_allocated = SUM(shares_owned) for active links on that share class
  2. Validate: (total_shares_issued - shares_transferred) >= v_allocated
     If not: RAISE EXCEPTION with allocated count
  3. UPDATE share_classes SET total_shares_issued = total_shares_issued - shares_transferred
  4. Skip equity_links changes entirely
  5. Recalculate percentages for all active holders

When from_entity_id IS NOT NULL:
  Existing logic (cancel from specific holder) unchanged
```

Same fix applied to `void_movement` — reverse branch handles NULL from_entity_id by adding shares back to total_shares_issued only.

## 2. Fix `Step2Parties.tsx` — CAPITAL_DECREASE optional holder

- Remove `CAPITAL_DECREASE` from the `needsFrom` array (line 23)
- Add a toggle/option: "Reduce unallocated shares" vs "Cancel from holder"
- When "unallocated" is selected, `from_entity_id` stays NULL
- When "from holder" is selected, show holder dropdown as before
- Add validation: if unallocated mode, check `total_shares_issued - allocated >= shares_transferred`

## 3. Update error messages

**File: `src/components/movement/Step2Parties.tsx`**
- Add issuance validation: when movement_type is ISSUANCE, compute unallocated = total_shares_issued - allocated. If unallocated <= 0, show:
  "No unallocated shares available in this class. Record a Capital Increase movement first to add new shares before issuing."

**File: Migration (validate_share_class_total_shares function)**
- Update the RAISE EXCEPTION message to:
  `'Cannot reduce total below % shares — % shares are currently allocated to active shareholders'`

## 4. Database cleanup (executed via browser/RPC after code deploys)

Void in reverse order:
1. Void Transfer fb31e0d8 (Person A → Co B, 100sh, 2026-04-02)
2. Void Transfer b2ddc8cd (Person A → Aisha, 200sh, 2026-04-01)
3. Void Capital Increase 8b32b32c (+200 to Aisha, 2026-04-02)
4. Delete 5 drafts: ac548e25, 08d5bcc3, e843bc7f, 9d78fdc2, 554152bb

## 5. Activate Co B

Call `activate_live_mode` RPC for Co B (id: c1e971df-95cc-478a-8778-83694c918bd3).
Co B currently has equity links to Co A (100 Ordinary shares from the transfer that will be voided in step 4 — so after cleanup Co B will have NO equity links in Co A). Co B's own equity links (Co A owns Ordinary + Preference in Co B) will generate opening balance movements.

## 6. Verify starting state

SQL queries to confirm:
- Co A: 1,000 Ordinary, Person A 700sh (70%), Aisha 300sh (30%), no others
- Co B: captable_status = 'live', opening balances confirmed
- 0 draft movements remaining

## Files changed

| File | Change |
|------|--------|
| Migration SQL | Update `confirm_movement` + `void_movement` for NULL from_entity_id on CAPITAL_DECREASE; update `validate_share_class_total_shares` error message |
| `src/components/movement/Step2Parties.tsx` | Make holder optional for CAPITAL_DECREASE; add unallocated issuance warning |
| `src/components/MovementWizard.tsx` | Update `canGoNext` — CAPITAL_DECREASE doesn't require from_entity_id when reducing unallocated |

## Execution order
1. Deploy migration + code changes
2. Void 3 confirmed movements via browser
3. Delete 5 drafts via browser
4. Activate Co B via browser
5. Verify state with SQL queries
6. Report ready for Group 1

