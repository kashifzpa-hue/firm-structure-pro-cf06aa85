# Bank Account Services & Request Tracking

Add a way to record the services a company holds on each bank account (internet banking access, sweep facility, statement delivery, cheque books, cards, etc.) and a full audit trail of every request sent to the bank to add, change, or cancel those services.

## Concept

Two linked layers, both attached to a bank account:

1. **Facilities** — the current state: what services exist on the account right now, who holds them, and their limits.
2. **Service Requests** — the paper trail: every instruction sent to the bank, its status, dates, reference numbers, and supporting documents. Completing a request can update the related facility.

```text
Bank Account
 ├── Facilities (current state)
 │     Internet Banking · Sweep · Statements · Cheque Book · Cards · Other
 └── Service Requests (history)
       Draft → Submitted → Acknowledged → In Progress → Completed / Rejected / Cancelled
```

## Facilities

Each facility record captures:
- Facility type: Internet Banking Access, Sweep / Auto-Sweep, Statement Delivery, Cheque Book, Debit/Credit Card, Standing Instruction, Trade Finance Line, Payroll/WPS, Host-to-Host / API, Other
- Status: Requested, Active, Suspended, Cancelled
- Person linked (for user-based facilities such as internet banking or cards) — picked from workspace people
- Access level for internet banking: View Only, Initiator, Approver, Administrator
- Limits: transaction limit, daily limit, currency
- Sweep details: linked/target account, sweep type (auto sweep in/out, target balance), threshold amount, frequency
- Statement details: delivery method (email, post, portal), frequency (daily/weekly/monthly), recipient emails
- Effective date, end date, bank reference, notes

## Borrowing / Credit Facilities

A dedicated facility group for funded and non-funded borrowing lines, recorded per bank account:
- Limit type: Overdraft, Term Loan, Revolving Credit, Working Capital, Invoice/Bill Discounting, Letter of Credit (sight/usance), Bank Guarantee, Trust Receipt, Trade Loan, Equipment/Asset Finance, Credit Card Limit, Other
- Funded vs non-funded classification, and whether it sits under a shared umbrella/combined limit
- Sanctioned limit amount and currency, sub-limit of a parent line (optional), utilised amount as last recorded with an "as of" date
- Pricing: interest/margin basis (e.g. EIBOR + spread), commission or fee notes, tenor
- Security/collateral summary, guarantor entity (linked to a workspace entity), covenant notes
- Key dates: sanction date, availability start date, **next review/renewal date**, **expiry date**, last renewed on
- Status: Proposed, Sanctioned, Active, Under Renewal, Expired, Cancelled
- Facility offer letter / sanction letter reference and attachments

Renewal and expiry tracking:
- Status badges follow the existing convention — green Valid, amber Expiring Soon (within the workspace threshold), red Expired/Overdue review — calculated from review and expiry dates.
- A summary strip on the account shows total sanctioned, total utilised, and headroom by currency.
- New alert rules for borrowing limit review due and borrowing limit expiring, using the same alert-rule and notification pattern as document expiry, with in-app and email options.
- Renewal actions create a linked service request (type Limit Renewal), so each renewal cycle keeps its own paper trail and history of previous limit amounts and dates.



## Service Requests

Each request captures:
- Request type: New Facility, Modify, Suspend, Reactivate, Cancel, Access Reset, Limit Change, Signatory Update, Other
- Related facility (optional — blank when requesting something new)
- Subject / description of what was asked
- Status with dates: date requested, date submitted to bank, bank acknowledgement date, expected completion, actual completion date
- Bank contact / relationship manager handling it, bank reference number
- Requested by (workspace user), approved by
- Outcome notes / rejection reason
- Attachments: request letter, board resolution, bank acknowledgement, confirmation — stored with the same encrypted upload flow used by existing bank documents

Status changes are appended to the existing banking activity log so the account timeline shows the full history.

## UI

- New **Facilities** tab on the bank account detail page: cards grouped by facility type with status badges, limits, and linked person; add/edit/cancel actions for admins.
- New **Borrowing Limits** section within Facilities: table of sanctioned limits with type, amount, utilised, headroom, review date, expiry date and status badge, sorted with soonest review first.
- New **Service Requests** tab: table of requests (type, subject, status, requested date, bank ref, days open) with filters by status and type, a detail drawer showing the timeline and attachments, and a "Log Request" button.
- Facility detail shows its request history inline.
- Overdue requests (past expected completion and not complete) are flagged amber; the bank account list gets a small counter of open requests and of limits due for review.
- Optional alert rules so open requests past their expected date, and borrowing limits nearing review or expiry, raise notifications, matching the existing alert-rule pattern.

## Technical notes

- New tables: `bank_facilities`, `bank_credit_limits`, `bank_service_requests`, and `bank_service_request_documents`, all workspace-scoped with the same RLS pattern as `bank_accounts` (admins write, workspace members read) and explicit grants.
- New enums for facility type/status, credit limit type and status, request type/status, internet-banking access level, statement frequency and delivery method.

- Reuse `logBankingActivity` for audit entries and `encryptedUpload`/`encryptedDownload` for attachments.
- Constants and label helpers added to `src/lib/banking-utils.ts`; new components under `src/components/banking/`.
- Facility and request lists load through React Query, consistent with recently migrated pages.
