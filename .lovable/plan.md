

# Phase 9 — Banking Module Build Plan

## Summary

Build a premium Banking Module gated by `banking_enabled` on the workspaces table. Includes bank accounts, signatories with secure signature processing, signing matrix rules, activity logging, a signatory register, reports integration, alerts integration, and dashboard updates. All 5 corrections from the user are incorporated.

---

## Step 1: Database Migration

Single migration creating:

### Schema changes
- Add `banking_enabled BOOLEAN DEFAULT false` to `workspaces`
- Set `banking_enabled = true` for the current workspace

### New tables (all with RLS by `workspace_id = get_user_workspace_id()`)

1. **bank_accounts** — company bank account records with masked account numbers, UAE bank presets, RM contact info
2. **signatory_groups** — named groups per bank account (Group A, Group B, etc.)
3. **signatories** — person-entity linked authorities with limits, authorisation scope, signature URLs, board resolution refs, status (active/suspended/revoked)
4. **signing_matrix_rules** — combination rules (solo/joint_same_group/joint_cross_group) with transaction and daily limits
5. **bank_account_documents** — bank-related document uploads
6. **banking_activity_log** — audit trail for all banking module actions

### New enums
- `bank_account_type`: current, savings, call_deposit, trade_finance
- `bank_account_status`: active, dormant, closed
- `signatory_status`: active, suspended, revoked
- `signing_rule_type`: solo, joint_same_group, joint_cross_group

### New notification types
- Add `SIGNATORY_EXPIRING` and `BANK_ACK_PENDING` to the `notification_type` enum

### Storage buckets
- `signatures` bucket (private, NOT public) for processed images only
- Original signatures stored in a separate non-public path within the same bucket, protected by RLS + edge function 403

### RLS policies
- All tables: workspace-scoped SELECT/INSERT/UPDATE/DELETE for authenticated users
- Storage: only processed paths accessible; original paths blocked

---

## Step 2: Edge Function — apply-signature-overlay

`supabase/functions/apply-signature-overlay/index.ts`

- Accepts uploaded signature image (base64 or form-data)
- Stores original to `signatures/original/{workspace_id}/{signatory_id}` (private)
- Processes image: resize 600×200, greyscale, crosshatch overlay (navy 35% opacity, 12px spacing, 45°/135°), "CORPSYNC RECORD ONLY" watermark
- Stores processed to `signatures/processed/{workspace_id}/{signatory_id}`
- Returns processed URL only
- **Correction #2**: Explicitly returns 403 for ANY request path containing `signatures/original/` regardless of auth status

---

## Step 3: Reusable Activity Logger

`src/lib/banking-utils.ts`

- `logBankingActivity(bankAccountId, actionType, details, doneBy)` helper
- Inserts into `banking_activity_log` table
- Called at the end of every successful mutation in the banking module (signatory add/edit/revoke, matrix rule CRUD, account update, document upload, group create/rename)
- **Correction #5**: Every mutation endpoint calls this function

---

## Step 4: Banking Pages & Components

### New pages
1. **`src/pages/BankAccounts.tsx`** — Master list with summary cards (total accounts, active, companies with banking, signatories expiring). Table with masked account numbers. Filters by company, bank, status, currency. "Add Bank Account" modal with UAE bank presets dropdown.

2. **`src/pages/BankAccountDetail.tsx`** — 5 tabs:
   - Tab 1: Account Details (read-only + edit)
   - Tab 2: Signatories (grouped by signatory_group, cards with processed signature images, "Reference record only" label)
   - Tab 3: Signing Matrix (table of rules + Add Rule modal)
   - Tab 4: Documents (bank-related doc uploads)
   - Tab 5: Activity Log (chronological audit trail from `banking_activity_log`)

3. **`src/pages/SignatoryRegister.tsx`** — Cross-workspace signatory view with summary cards, expiry tracking, CSV export

### New components
- `src/components/banking/BankAccountForm.tsx` — Add/edit bank account modal
- `src/components/banking/SignatoryForm.tsx` — 3-step add signatory modal (select person → authority/limits → signature upload with security notice)
- `src/components/banking/MatrixRuleForm.tsx` — Add/edit signing matrix rule modal
  - **Correction #3**: Live preview sentence below form that updates dynamically: "This rule means: Any [N] person(s) from [Group X] can authorize [Payments, Cheques] up to [AED 100,000] per transaction"
- `src/components/banking/SignatoryCard.tsx` — Individual signatory display card
- `src/components/banking/BankingTab.tsx` — Banking tab for company entity detail page

### Account number masking
- **Correction #4**: Account number/IBAN reveal toggle ONLY visible to Admin users (checked via `userRole` from `useAuth()`). Viewers see masked values (last 4 digits) with no toggle.

---

## Step 5: Navigation Update

Modify `src/components/AppSidebar.tsx`:
- Add "BANKING" section divider below UBO Registry
- Two nav items: "Bank Accounts" (Landmark icon), "Signatory Register" (PenLine icon)
- Conditionally rendered based on `banking_enabled` from workspace
- If disabled: show locked item with upgrade prompt

---

## Step 6: Routes

Add to `src/App.tsx`:
- `/bank-accounts` → BankAccounts
- `/bank-accounts/:id` → BankAccountDetail
- `/signatory-register` → SignatoryRegister

---

## Step 7: Entity Detail — Banking Tab

Add "Banking" tab to company entity detail page showing:
- Collapsible cards per bank account with signatory summary and matrix overview
- "Add Bank Account" button
- Links to full account detail

---

## Step 8: Reports — Bank Signatory Report

Add 5th report card to `src/pages/Reports.tsx`:
- Configuration modal: company, bank account, report purpose, prepared by, date
- PDF content: company details, signatories grouped with processed signature images, signing matrix table, declaration section
- New component: `src/components/reports/BankSignatoryPdf.tsx`

---

## Step 9: Alerts Integration

Update edge functions:
- `check-document-expiry` — add check for signatory expiry dates, create `SIGNATORY_EXPIRING` notifications
- New logic in existing functions or new scheduled check for `BANK_ACK_PENDING` (signatories active >14 days without bank_acknowledged_date)
- Add these two rule types to default alert rules creation

Update `src/components/AlertRulesTab.tsx` — add the two new rule types to the settings UI

---

## Step 10: Dashboard Update

Modify `src/pages/Dashboard.tsx`:
- Add "Banking Overview" section (conditional on `banking_enabled`)
- Cards: total bank accounts, active signatories, expiring within 30 days, awaiting bank acknowledgement

---

## Files Summary

| Action | File |
|--------|------|
| Migration | New tables, enums, storage bucket, RLS |
| Create | `supabase/functions/apply-signature-overlay/index.ts` |
| Create | `src/lib/banking-utils.ts` |
| Create | `src/pages/BankAccounts.tsx` |
| Create | `src/pages/BankAccountDetail.tsx` |
| Create | `src/pages/SignatoryRegister.tsx` |
| Create | `src/components/banking/BankAccountForm.tsx` |
| Create | `src/components/banking/SignatoryForm.tsx` |
| Create | `src/components/banking/MatrixRuleForm.tsx` |
| Create | `src/components/banking/SignatoryCard.tsx` |
| Create | `src/components/banking/BankingTab.tsx` |
| Create | `src/components/reports/BankSignatoryPdf.tsx` |
| Modify | `src/components/AppSidebar.tsx` — banking nav items |
| Modify | `src/App.tsx` — new routes |
| Modify | `src/pages/EntityDetail.tsx` — banking tab |
| Modify | `src/pages/Reports.tsx` — 5th report card |
| Modify | `src/pages/Dashboard.tsx` — banking overview section |
| Modify | `src/components/AlertRulesTab.tsx` — new rule types |
| Modify | Edge functions — signatory expiry + bank ack alerts |

