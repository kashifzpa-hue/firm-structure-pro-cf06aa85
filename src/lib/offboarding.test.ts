import { describe, it, expect } from "vitest";
import {
  buildOffboardingSteps,
  canDeactivatePerson,
  emptyExposure,
  exposureCount,
  groupStepsByStage,
  offboardingProgress,
  stepNeedsBankRequest,
  type PersonExposure,
} from "./offboarding";

const exposure: PersonExposure = {
  signatories: [
    {
      id: "sig-1",
      designation: "Authorised Signatory A",
      bank_account_id: "acc-1",
      account: { id: "acc-1", bank_name: "Emirates NBD", account_number: "1011", cif_id: "cif-1" },
    },
    {
      id: "sig-2",
      designation: "Authorised Signatory B",
      bank_account_id: "acc-2",
      account: { id: "acc-2", bank_name: "Mashreq", account_number: "2022", cif_id: "cif-2" },
    },
  ],
  facilities: [
    {
      id: "fac-1",
      facility_type: "internet_banking",
      cif_id: "cif-1",
      access_level: "approver",
      token_serial: "TK-99",
      cif: { id: "cif-1", bank_name: "Emirates NBD", cif_number: "C-1" },
    },
  ],
  appointments: [
    { id: "app-1", role_title: "Director", role_category: "board", company: { id: "co-1", name: "AVMC Holding" } },
  ],
  guarantees: [
    { id: "lim-1", limit_type: "overdraft", sanctioned_amount: 500000, currency: "AED", cif: { id: "cif-1", bank_name: "Emirates NBD" } },
  ],
  shareholdings: [{ id: "eq-1", percentage: 10, owned: { id: "co-1", name: "AVMC Holding" } }],
};

describe("exposure", () => {
  it("counts every linkage", () => {
    expect(exposureCount(exposure)).toBe(6);
    expect(exposureCount(emptyExposure())).toBe(0);
  });
});

describe("buildOffboardingSteps", () => {
  const steps = buildOffboardingSteps(exposure, "Jane Doe");

  it("always starts with the internal approval step", () => {
    expect(steps[0].stage).toBe(1);
    expect(steps[0].category).toBe("approval");
    expect(steps[0].description).toContain("Jane Doe");
  });

  it("creates one revocation step per signatory mandate", () => {
    const mandateSteps = steps.filter((s) => s.category === "signatory");
    expect(mandateSteps).toHaveLength(2);
    expect(mandateSteps[0].title).toBe("Revoke signatory mandate — Emirates NBD — A/C 1011");
    expect(mandateSteps[0].signatory_id).toBe("sig-1");
    expect(mandateSteps[0].bank_account_id).toBe("acc-1");
    expect(mandateSteps[0].cif_id).toBe("cif-1");
    expect(mandateSteps[1].signatory_id).toBe("sig-2");
  });

  it("creates facility, appointment, guarantee and shareholding steps", () => {
    expect(steps.filter((s) => s.category === "facility")).toHaveLength(1);
    expect(steps.filter((s) => s.category === "appointment")).toHaveLength(1);
    expect(steps.filter((s) => s.category === "guarantee")).toHaveLength(1);
    expect(steps.filter((s) => s.category === "shareholding")).toHaveLength(1);
  });

  it("mentions the token that must be returned", () => {
    const fac = steps.find((s) => s.category === "facility")!;
    expect(fac.description).toContain("TK-99");
    expect(fac.facility_id).toBe("fac-1");
  });

  it("ends with archiving documents then deactivating the record", () => {
    expect(steps.at(-2)?.category).toBe("document");
    expect(steps.at(-1)?.category).toBe("closeout");
    expect(steps.at(-1)?.stage).toBe(6);
  });

  it("numbers steps in strictly ascending stage and order", () => {
    steps.forEach((s, i) => expect(s.display_order).toBe(i));
    const stages = steps.map((s) => s.stage);
    expect([...stages].sort((a, b) => a - b)).toEqual(stages);
  });

  it("still produces approval and close-out steps with no exposure", () => {
    const minimal = buildOffboardingSteps(emptyExposure());
    expect(minimal).toHaveLength(3);
    expect(minimal.map((s) => s.category)).toEqual(["approval", "document", "closeout"]);
  });
});

describe("offboardingProgress", () => {
  it("counts closed steps and open mandates", () => {
    const p = offboardingProgress([
      { status: "done", category: "approval" },
      { status: "submitted", category: "signatory" },
      { status: "acknowledged", category: "signatory" },
      { status: "not_applicable", category: "guarantee" },
    ]);
    expect(p.total).toBe(4);
    expect(p.closed).toBe(2);
    expect(p.open).toBe(2);
    expect(p.openMandates).toBe(2);
    expect(p.percent).toBe(50);
    expect(p.complete).toBe(false);
  });

  it("is complete only when every step is done or not applicable", () => {
    expect(offboardingProgress([{ status: "done" }, { status: "not_applicable" }]).complete).toBe(true);
    expect(offboardingProgress([]).complete).toBe(false);
  });
});

describe("canDeactivatePerson", () => {
  it("blocks deactivation while mandates remain open", () => {
    const r = canDeactivatePerson([
      { status: "done", category: "approval" },
      { status: "submitted", category: "signatory" },
    ]);
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("1 bank signatory mandate");
  });

  it("blocks on non-mandate steps too, without naming mandates", () => {
    const r = canDeactivatePerson([{ status: "pending", category: "appointment" }]);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("1 offboarding step(s) still open.");
  });

  it("allows deactivation when everything is closed", () => {
    expect(canDeactivatePerson([{ status: "done" }, { status: "not_applicable" }]).allowed).toBe(true);
  });

  it("allows deactivation when no offboarding was started", () => {
    expect(canDeactivatePerson([]).allowed).toBe(true);
  });
});

describe("stepNeedsBankRequest", () => {
  it("is true for bank-facing categories only", () => {
    expect(stepNeedsBankRequest({ category: "signatory" })).toBe(true);
    expect(stepNeedsBankRequest({ category: "facility" })).toBe(true);
    expect(stepNeedsBankRequest({ category: "guarantee" })).toBe(true);
    expect(stepNeedsBankRequest({ category: "appointment" })).toBe(false);
    expect(stepNeedsBankRequest({ category: "closeout" })).toBe(false);
  });
});

describe("groupStepsByStage", () => {
  it("groups and labels stages in order", () => {
    const groups = groupStepsByStage(buildOffboardingSteps(exposure));
    expect(groups.map((g) => g.stage)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(groups[1].label).toBe("Bank signatory mandates");
    expect(groups[1].steps).toHaveLength(2);
  });
});
