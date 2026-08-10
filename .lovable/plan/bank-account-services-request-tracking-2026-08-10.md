# Bank Account Services & Request Tracking

Add a way to record the services a company holds on each bank account (internet banking access, sweep facility, statement delivery, cheque books, cards, borrowing limits) and a full audit trail of every request sent to the bank to add, change, or cancel those services.

## Concept

Two linked layers, both attached to a bank account, kept separate so "what is active right now" stays fast and independent from the historical audit trail:

1. **Facilities** — the current state: what services exist on the account right now, who holds them, and their limits.
2. **Service Requests** — the paper trail: every instruction sent to the bank, its status, dates, reference numbers, and supporting documents. Completing a request can update the related facility.

```text
Bank Account
 ├── Facilities (current state)
 │     Internet Banking · Sweep · Statements · Cheque Book · Cards · Other
 ├── Borrowing Limits (sanctioned lines, review + expiry dates)
 └── Service Requests (history)
       Draft → Submitted → Acknowledged → In Progress → Completed / Rejected / Cancelled
```

## Facilities

Each facility record captures:
- Facility type: Internet Banking Access, Sweep / Auto-Sweep, Statement Delivery, Cheque Book, Debit/Credit Card, Standing Instruction, Trade Finance Line, Payroll/WPS, Host-to-Host / API, Other
- Status: Requested, Active, Suspended, Cancelled
- Person linked (for user-based facilities such as internet banking or cards) — picked from workspace people. One row = one person = one role, so an account can hold several internet-banking rows.
- Access level for internet banking: View Only, Initiator, Approver, Administrator
- Token / device: hardware token serial, mobile app registration reference, issue date, status (issued, lost, replaced, returned)
- Limits: transaction limit, daily limit, currency
- Sweep details: linked/target account, sweep type (auto sweep in/out, target balance), threshold amount, frequency
- Statement details: delivery method (email, post, portal), frequency (daily/weekly/monthly), recipient emails
- Cheque book details (kept on the facility, no separate table): cheque book number, leaf range start/end, issue date
- Cost: annual/recurring fee amount and currency, plus free-text fee notes for per-transaction charges
- Umbrella reference: free-text shared reference so a group-wide facility duplicated across accounts can be grouped in reporting (no many-to-many table)
- Effective date, end date, bank reference, notes

### Internet banking roster and dual control

- The Facilities tab shows Internet Banking Access as a single roster block listing every person and their role, not one card per person.
- A dual-control check flags any person holding both Initiator and Approver on the same account, and any account with an Initiator but no Approver. Shown as a warning strip on the account and rolled up in reporting.

### Person offboarding view

- A "Bank access by person" view lists every facility linked to a person across all accounts, so when someone leaves or changes role their full bank footprint is visible in one place.
- From that view, a bulk action pre-fills Cancel / Access Reset service requests for the selected facilities.
- Deactivating a person entity surfaces a prompt showing their linked bank facilities.

## Borrowing / Credit Facilities

A dedicated facility group for funded and non-funded borrowing lines, recorded per bank account:
- Limit type: Overdraft, Term Loan, Revolving Credit, Working Capital, Invoice/Bill Discounting, Letter of Credit (sight/usance), Bank Guarantee, Trust Receipt, Trade Loan, Equipment/Asset Finance, Credit Card Limit, Other
- Funded vs non-funded classification, and whether it sits under a shared umbrella/combined limit (same umbrella reference field as facilities)
- Sanctioned limit amount and currency, sub-limit of a parent line (optional), utilised amount as last recorded with an "as of" date
- Pricing: interest/margin basis (e.g. EIBOR + spread), commission or fee notes, tenor
- Security/collateral summary, guarantor entity (linked to a workspace entity), covenant notes
- Key dates: sanction date, availability start date, **next review/renewal date**, **expiry date**, last renewed on
- Status: Proposed, Sanctioned, Active, Under Renewal, Expired, Cancelled
- Facility offer letter / sanction letter reference and attachments

Renewal and expiry tracking:
- Status badges follow the existing convention — green Valid, amber Expiring Soon (within the workspace threshold), red Expired/Overdue review — calculated from review and expiry dates.
- A summary strip on the account shows total sanctioned, total utilised, and headroom by currency.
- Renewal actions create a linked service request (type Limit Renewal), so each renewal cycle keeps its own paper trail and history of previous limit amounts and dates.

## Service Requests

Each request captures:
- Request type: New Facility, Modify, Suspend, Reactivate, Cancel, Access Reset, Limit Change, Limit Renewal, New Cheque Book, Token Replacement, Stop Payment, Signatory Update, Other
- Related facility or borrowing limit (optional — blank when requesting something new)
- Subject / description of what was asked
- Status with dates: date requested, date submitted to bank, bank acknowledgement date, expected completion, actual completion date
- Bank contact / relationship manager handling it, bank reference number
- Requested by (workspace user), approved by
- Outcome notes / rejection reason (cheque book leaf ranges and similar details are recorded here)
- Attachments: request letter, board resolution, bank acknowledgement, confirmation — stored with the same encrypted upload flow used by existing bank documents

Signatory Update requests link to the existing `signatories` record on the bank account rather than to a facility. Marking such a request Completed prompts the user to update the linked signatory (effective date, board resolution reference, bank acknowledgement date) so the register and the request trail stay in step.

Status changes are appended to the existing banking activity log so the account timeline shows the full history.

## UI

- New **Facilities** tab on the bank account detail page: grouped by facility type, with the internet banking roster, dual-control warnings, status badges, limits, fees and linked person; add/edit/cancel actions for admins.
- New **Borrowing Limits** section: table of sanctioned limits with type, amount, utilised, headroom, review date, expiry date and status badge, sorted with soonest review first.
- New **Service Requests** tab: table of requests (type, subject, status, requested date, bank ref, days open) with filters by status and type, a detail drawer showing the timeline and attachments, and a "Log Request" button.
- Facility and limit detail show their request history inline.
- Overdue requests (past expected completion and not complete) are flagged amber; the bank account list gets counters for open requests and limits due for review.
- Person detail page gains a "Bank Access" section listing that person's facilities across accounts.

## Alerts

New alert rules following the existing alert-rule pattern:
- Service request open past expected completion
- Borrowing limit review due / borrowing limit expiring
- Facility linked to a deactivated person still active

Each rule specifies its recipients explicitly — a chosen finance/treasury user, the account's relationship-manager owner, or additional email addresses — reusing the `additional_emails` and per-rule recipient fields already on `alert_rules`, rather than blanket-notifying all admins.

## Technical notes

- New tables: `bank_facilities`, `bank_credit_limits`, `bank_service_requests`, and `bank_service_request_documents`, all workspace-scoped with the same RLS pattern as `bank_accounts` (admins write, workspace members read) and explicit grants.
- New enums for facility type/status, credit limit type and status, request type/status, internet-banking access level, token status, statement frequency and delivery method.
- Reuse `logBankingActivity` for audit entries and `encryptedUpload`/`encryptedDownload` for attachments.
- Constants and label helpers added to `src/lib/banking-utils.ts`; new components under `src/components/banking/`. Dual-control and headroom logic go in pure helpers with unit tests.
- Facility, limit, and request lists load through React Query, consistent with recently migrated pages.

## Build order

1. `bank_facilities` + Facilities tab — immediate "what do we have" view.
2. `bank_service_requests` + Service Requests tab — the audit trail.
3. `bank_credit_limits` + Borrowing Limits section — renewal and expiry dates.
4. Dual-control checks, person offboarding view, alert rules and summary counters.
