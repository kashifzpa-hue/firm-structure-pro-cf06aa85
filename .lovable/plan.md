

# Movement Ledger — Final Implementation Plan

## Overview
Build the Movement Ledger as the single source of truth for all equity changes in Live Mode companies. This is a large feature spanning database, backend RPCs, and multiple new UI pages/components.

---

## Step 1: Database Migration

One migration creating:

**3 Enums:** `movement_type` (TRANSFER, ISSUANCE, CANCELLATION, INHERITANCE, GIFT, COURT_ORDER, CAPITAL_INCREASE, CAPITAL_DECREASE), `movement_status` (draft, confirmed, voided), `movement_document_type` (9 values)

**Table: `movements`** — id, workspace_id, company_entity_id (FK→entities), share_class_id (FK→share_classes), movement_type, from_entity_id (FK→entities, nullable), to_entity_id (FK→entities, nullable), shares_transferred (int >0), price_per_share (numeric, nullable), currency (text, nullable), total_consideration (numeric, nullable), movement_date (date), reference_number (text, nullable), notes (text, nullable), status (default 'draft'), created_by (FK→profiles.id), created_at, confirmed_at, voided_at, void_reason. RLS by workspace_id.

**Table: `movement_documents`** — id, movement_id (FK→movements), workspace_id, document_type, file_url, uploaded_at, notes. RLS by workspace_id.

**RPC: `confirm_movement(p_movement_id uuid)`** — SECURITY DEFINER, single transaction:
1. Validate movement is draft and belongs to user's workspace
2. For TRANSFER/INHERITANCE/GIFT/COURT_ORDER: reduce seller's `equity_links.shares_owned`, increase/create buyer's equity_link, auto-close (set end_date) if shares reach 0
3. For ISSUANCE: create/update buyer equity_link
4. For CANCELLATION: reduce holder's shares, auto-close if 0
5. For CAPITAL_INCREASE/DECREASE: update `share_classes.total_shares_issued`
6. **Recalculate percentages** for ALL equity_links of that company+share_class: `percentage = (shares_owned::numeric / total_shares_issued) * 100`
7. Set status='confirmed', confirmed_at=now()

**RPC: `void_movement(p_movement_id uuid, p_reason text)`** — SECURITY DEFINER, single transaction:
1. Validate movement is confirmed
2. Check for **subsequent movements**: any confirmed movement where `from_entity_id = original.to_entity_id` AND `movement_date > original.movement_date` AND same `company_entity_id` AND same `share_class_id`. If found, block with error.
3. Reverse all equity link changes (opposite of confirm)
4. **Recalculate percentages** for all affected equity_links
5. Set status='voided', voided_at=now(), void_reason=p_reason

**RPC: `activate_live_mode(p_entity_id uuid)`** — SECURITY DEFINER, single transaction:
1. Set `entities.captable_status = 'live'`
2. For each active equity_link of that company, create a confirmed ISSUANCE movement with notes "Opening balance — imported from Setup Mode on [date] by [user]"

---

## Step 2: Navigation & Routes

- **AppSidebar.tsx**: Add "Ledger" with `ScrollText` icon after "Org Chart"
- **App.tsx**: Add `/ledger` → Ledger page, `/ledger/:id` → MovementDetail page

---

## Step 3: Ledger List Page

**New file: `src/pages/Ledger.tsx`**

- Table sorted by movement_date DESC
- Columns: Date, Company, Type (color badge), Share Class, From, To, Shares, Consideration, Status badge, Actions
- Filters: search text, company dropdown, movement type multi-select, status (All/Draft/Confirmed/Voided), date range
- "Export to CSV" — exports **only filtered rows** with columns: Date, Company, Movement Type, Share Class, From, To, Shares Transferred, Price Per Share, Currency, Total Consideration, Reference Number, Status
- "Record Movement" button → opens wizard
- Actions: View (always), Edit (draft), Void (confirmed), Delete (draft)

---

## Step 4: Record Movement Wizard

**New files:** `src/components/MovementWizard.tsx` + 4 step sub-components in `src/components/movement/`

**Step 1 — Details:** Company selector (only Live Mode companies with share classes), movement type card selector, movement date (future warning), reference number (duplicate warning: amber if same ref exists for same company)

**Step 2 — Parties & Shares:** Dynamic per movement type with live validation. For CAPITAL_INCREASE/DECREASE: show before/after percentage table for all existing shareholders (dilution preview).

**Step 3 — Consideration:** Optional toggle, price per share, currency, computed total.

**Step 4 — Documents & Confirm:** Document uploads to `documents` storage bucket, summary panel. "Save as Draft" / "Confirm Movement" (calls `confirm_movement` RPC). Out-of-order warning with acknowledgement checkbox if earlier drafts exist for same company+share_class. Future-dated movements: draft only.

---

## Step 5: Movement Detail Page

**New file: `src/pages/MovementDetail.tsx`**

- Full read-only detail view with header (type badge, company, date, status)
- "Shareholding Impact" before/after table (green/red rows)
- Documents section with download links
- Audit log sidebar (created/confirmed/voided timestamps)
- Voided: red "VOIDED" stamp overlay at 50% opacity
- Draft: banner with confirm action

---

## Step 6: Entity Detail Updates

**Modified: `src/pages/EntityDetail.tsx`**

- Add **"Ledger" tab** for companies — movements filtered to that company
- Add **"Cap Table as of Date"** time machine with date picker. Replays confirmed movements up to selected date. If date < incorporation date → empty state message.
- Add **"Transaction History"** sub-section in Ownership tab for all entities
- Update `handleActivateLiveMode` to call `activate_live_mode` RPC instead of direct update

---

## Step 7: Dashboard Updates

**Modified: `src/pages/Dashboard.tsx`**

- "Pending Drafts" summary card (amber, count of draft movements, click → Ledger filtered to Draft)
- "Recent Movements" section: last 5 confirmed movements

---

## Files Summary

| Action | File |
|--------|------|
| Create | `src/pages/Ledger.tsx` |
| Create | `src/pages/MovementDetail.tsx` |
| Create | `src/components/MovementWizard.tsx` |
| Create | `src/components/movement/Step1Details.tsx` |
| Create | `src/components/movement/Step2Parties.tsx` |
| Create | `src/components/movement/Step3Consideration.tsx` |
| Create | `src/components/movement/Step4Confirm.tsx` |
| Modify | `src/components/AppSidebar.tsx` |
| Modify | `src/App.tsx` |
| Modify | `src/pages/Dashboard.tsx` |
| Modify | `src/pages/EntityDetail.tsx` |
| Migration | 1 SQL: enums + 2 tables + RLS + 3 RPCs |

