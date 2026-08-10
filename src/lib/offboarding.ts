/**
 * Person offboarding (exit) workflow helpers.
 *
 * When a person leaves, every authority they hold has to be withdrawn one at a
 * time — each bank mandate is a separate letter to a separate bank, each with
 * its own acknowledgement. These helpers turn a person's current exposure into
 * an ordered checklist of steps and compute progress over it.
 */

export type OffboardingStepStatus =
  | "pending"
  | "submitted"
  | "acknowledged"
  | "done"
  | "not_applicable";

export type OffboardingStepCategory =
  | "approval"
  | "signatory"
  | "facility"
  | "appointment"
  | "guarantee"
  | "shareholding"
  | "document"
  | "closeout"
  | "other";

export const STEP_STATUS_LABELS: Record<OffboardingStepStatus, string> = {
  pending: "Pending",
  submitted: "Submitted to bank",
  acknowledged: "Bank acknowledged",
  done: "Done",
  not_applicable: "Not applicable",
};

export const STAGE_LABELS: Record<number, string> = {
  1: "Internal approval",
  2: "Bank signatory mandates",
  3: "Facilities & access",
  4: "Board & management roles",
  5: "Guarantees & shareholdings",
  6: "Close-out",
};

/** A step as generated before it is persisted. */
export interface StepDraft {
  stage: number;
  display_order: number;
  category: OffboardingStepCategory;
  title: string;
  description: string | null;
  bank_account_id?: string | null;
  cif_id?: string | null;
  signatory_id?: string | null;
  facility_id?: string | null;
  credit_limit_id?: string | null;
  appointment_id?: string | null;
}

export interface PersonExposure {
  signatories: Array<{
    id: string;
    designation?: string | null;
    bank_account_id?: string | null;
    signatory_group_id?: string | null;
    account?: {
      id: string;
      bank_name: string;
      account_number: string;
      cif_id?: string | null;
    } | null;
  }>;
  facilities: Array<{
    id: string;
    facility_type: string;
    cif_id?: string | null;
    bank_account_id?: string | null;
    access_level?: string | null;
    token_serial?: string | null;
    cif?: { id: string; bank_name: string; cif_number?: string | null } | null;
  }>;
  appointments: Array<{
    id: string;
    role_title: string;
    role_category: string;
    company?: { id: string; name: string } | null;
  }>;
  guarantees: Array<{
    id: string;
    limit_type: string;
    sanctioned_amount?: number | null;
    currency?: string | null;
    cif?: { id: string; bank_name: string } | null;
  }>;
  shareholdings: Array<{
    id: string;
    percentage?: number | null;
    shares_owned?: number | null;
    owned?: { id: string; name: string } | null;
  }>;
}

export const FACILITY_TYPE_LABELS: Record<string, string> = {
  internet_banking: "Internet banking access",
  sweep: "Sweep instruction",
  statement_delivery: "Statement delivery",
  cheque_book: "Cheque book custody",
  card: "Card",
  standing_instruction: "Standing instruction",
  trade_finance: "Trade finance facility",
  payroll_wps: "Payroll / WPS",
  host_to_host: "Host-to-host channel",
  other: "Facility",
};

export function emptyExposure(): PersonExposure {
  return { signatories: [], facilities: [], appointments: [], guarantees: [], shareholdings: [] };
}

export function exposureCount(e: PersonExposure): number {
  return (
    e.signatories.length +
    e.facilities.length +
    e.appointments.length +
    e.guarantees.length +
    e.shareholdings.length
  );
}

/**
 * Build the ordered removal checklist for a person from their current exposure.
 * Every bank mandate gets its own step so they can be revoked one by one.
 */
export function buildOffboardingSteps(exposure: PersonExposure, personName = "the person"): StepDraft[] {
  const steps: StepDraft[] = [];
  let order = 0;
  const push = (s: Omit<StepDraft, "display_order">) => {
    steps.push({ ...s, display_order: order++ });
  };

  // Stage 1 — internal approval
  push({
    stage: 1,
    category: "approval",
    title: "Board / shareholder resolution approving removal",
    description: `Pass and file the resolution authorising the removal of ${personName} from all roles and bank mandates. Record the reference on the offboarding record.`,
  });

  // Stage 2 — one step per bank signatory mandate
  for (const sig of exposure.signatories) {
    const acct = sig.account;
    const label = acct ? `${acct.bank_name} — A/C ${acct.account_number}` : "bank account";
    push({
      stage: 2,
      category: "signatory",
      title: `Revoke signatory mandate — ${label}`,
      description: [
        sig.designation ? `Designation: ${sig.designation}.` : null,
        "Draft the revocation letter, submit it to the bank, capture the bank acknowledgement date, then mark the mandate revoked and re-check the signing matrix for quorum.",
      ]
        .filter(Boolean)
        .join(" "),
      signatory_id: sig.id,
      bank_account_id: sig.bank_account_id ?? acct?.id ?? null,
      cif_id: acct?.cif_id ?? null,
    });
  }

  // Stage 3 — facilities and access
  for (const f of exposure.facilities) {
    const typeLabel = FACILITY_TYPE_LABELS[f.facility_type] ?? f.facility_type;
    const where = f.cif ? ` — ${f.cif.bank_name}${f.cif.cif_number ? ` (CIF ${f.cif.cif_number})` : ""}` : "";
    push({
      stage: 3,
      category: "facility",
      title: `Withdraw ${typeLabel.toLowerCase()}${where}`,
      description: [
        f.access_level ? `Access level: ${f.access_level}.` : null,
        f.token_serial ? `Token ${f.token_serial} must be returned to the bank.` : null,
        "Remove the user, revoke credentials, and confirm removal in writing with the bank.",
      ]
        .filter(Boolean)
        .join(" "),
      facility_id: f.id,
      cif_id: f.cif_id ?? f.cif?.id ?? null,
      bank_account_id: f.bank_account_id ?? null,
    });
  }

  // Stage 4 — board and management roles
  for (const a of exposure.appointments) {
    push({
      stage: 4,
      category: "appointment",
      title: `Record resignation — ${a.role_title}${a.company ? ` at ${a.company.name}` : ""}`,
      description:
        a.role_category === "board"
          ? "File the resignation with the registrar / licensing authority and update the register of directors."
          : "Record the resignation date and update the management register.",
      appointment_id: a.id,
    });
  }

  // Stage 5 — guarantees and shareholdings
  for (const g of exposure.guarantees) {
    const amount =
      g.sanctioned_amount != null ? ` (${g.currency ?? ""} ${Number(g.sanctioned_amount).toLocaleString()})`.trim() : "";
    push({
      stage: 5,
      category: "guarantee",
      title: `Obtain guarantor release — ${g.limit_type}${g.cif ? ` at ${g.cif.bank_name}` : ""}${amount ? ` ${amount}` : ""}`,
      description: "Request the bank's written release of the personal guarantee, or arrange a substitute guarantor.",
      credit_limit_id: g.id,
      cif_id: g.cif?.id ?? null,
    });
  }
  for (const s of exposure.shareholdings) {
    push({
      stage: 5,
      category: "shareholding",
      title: `Settle shareholding in ${s.owned?.name ?? "company"}`,
      description: "Transfer, buy back or otherwise settle the holding and record the movement in the ledger.",
    });
  }

  // Stage 6 — close-out
  push({
    stage: 6,
    category: "document",
    title: "Collect and archive exit documents",
    description: "Resignation letter, revocation acknowledgements, guarantee releases and handover notes.",
  });
  push({
    stage: 6,
    category: "closeout",
    title: "Deactivate person record",
    description: "Only possible once every step above is done or marked not applicable.",
  });

  return steps;
}

export const CLOSED_STATUSES: OffboardingStepStatus[] = ["done", "not_applicable"];

export function isStepClosed(status: OffboardingStepStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

export interface OffboardingProgress {
  total: number;
  closed: number;
  open: number;
  openMandates: number;
  percent: number;
  complete: boolean;
}

export function offboardingProgress(
  steps: Array<{ status: OffboardingStepStatus; category?: OffboardingStepCategory }>,
): OffboardingProgress {
  const total = steps.length;
  const closed = steps.filter((s) => isStepClosed(s.status)).length;
  const openMandates = steps.filter((s) => s.category === "signatory" && !isStepClosed(s.status)).length;
  return {
    total,
    closed,
    open: total - closed,
    openMandates,
    percent: total === 0 ? 0 : Math.round((closed / total) * 100),
    complete: total > 0 && closed === total,
  };
}

/** A person may only be deactivated once every offboarding step is closed. */
export function canDeactivatePerson(
  steps: Array<{ status: OffboardingStepStatus; category?: OffboardingStepCategory }>,
): { allowed: boolean; reason?: string } {
  if (steps.length === 0) return { allowed: true };
  const { open, openMandates } = offboardingProgress(steps);
  if (open === 0) return { allowed: true };
  return {
    allowed: false,
    reason:
      openMandates > 0
        ? `${open} offboarding step(s) still open, including ${openMandates} bank signatory mandate(s) that have not been revoked.`
        : `${open} offboarding step(s) still open.`,
  };
}

/** Steps that should raise a bank service request when they start. */
export function stepNeedsBankRequest(step: { category: OffboardingStepCategory }): boolean {
  return step.category === "signatory" || step.category === "facility" || step.category === "guarantee";
}

export function groupStepsByStage<T extends { stage: number; display_order?: number }>(
  steps: T[],
): Array<{ stage: number; label: string; steps: T[] }> {
  const stages = Array.from(new Set(steps.map((s) => s.stage))).sort((a, b) => a - b);
  return stages.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage] ?? `Stage ${stage}`,
    steps: steps
      .filter((s) => s.stage === stage)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
  }));
}
