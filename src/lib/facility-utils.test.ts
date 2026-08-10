import { describe, expect, it } from "vitest";
import {
  dateStatus,
  dualControlIssues,
  isRequestOverdue,
  limitTotalsByCurrency,
  labelFor,
  FACILITY_TYPES,
} from "@/lib/facility-utils";

const today = new Date(2026, 5, 1); // 1 June 2026

describe("dateStatus", () => {
  it("classifies against the warning window", () => {
    expect(dateStatus(null)).toBe("none");
    expect(dateStatus("2026-05-01", 60, today)).toBe("expired");
    expect(dateStatus("2026-06-15", 60, today)).toBe("expiring");
    expect(dateStatus("2027-01-01", 60, today)).toBe("valid");
  });

  it("treats today as expiring, not expired", () => {
    expect(dateStatus("2026-06-01", 60, today)).toBe("expiring");
  });
});

describe("isRequestOverdue", () => {
  it("only flags open requests past their expected date", () => {
    expect(isRequestOverdue({ status: "in_progress", expected_completion: "2026-05-01" }, today)).toBe(true);
    expect(isRequestOverdue({ status: "completed", expected_completion: "2026-05-01" }, today)).toBe(false);
    expect(isRequestOverdue({ status: "submitted", expected_completion: null }, today)).toBe(false);
    expect(isRequestOverdue({ status: "submitted", expected_completion: "2026-07-01" }, today)).toBe(false);
  });
});

describe("dualControlIssues", () => {
  const base = { facility_type: "internet_banking", status: "active" };

  it("flags a person holding initiator and approver", () => {
    const issues = dualControlIssues([
      { ...base, access_level: "initiator", person_entity_id: "p1", person_name: "Jane" },
      { ...base, access_level: "approver", person_entity_id: "p1", person_name: "Jane" },
    ]);
    expect(issues.some(i => i.kind === "both_roles" && i.personName === "Jane")).toBe(true);
  });

  it("flags an initiator with no approver", () => {
    const issues = dualControlIssues([
      { ...base, access_level: "initiator", person_entity_id: "p1", person_name: "Jane" },
    ]);
    expect(issues.map(i => i.kind)).toContain("no_approver");
  });

  it("stays quiet for a healthy roster", () => {
    const issues = dualControlIssues([
      { ...base, access_level: "initiator", person_entity_id: "p1", person_name: "Jane" },
      { ...base, access_level: "approver", person_entity_id: "p2", person_name: "Omar" },
    ]);
    expect(issues).toEqual([]);
  });

  it("ignores cancelled rows and other facility types", () => {
    const issues = dualControlIssues([
      { facility_type: "internet_banking", status: "cancelled", access_level: "initiator", person_entity_id: "p1" },
      { facility_type: "card", status: "active", access_level: "initiator", person_entity_id: "p2" },
    ]);
    expect(issues).toEqual([]);
  });
});

describe("limitTotalsByCurrency", () => {
  it("sums sanctioned and utilised per currency and derives headroom", () => {
    const totals = limitTotalsByCurrency([
      { currency: "AED", sanctioned_amount: 1000, utilised_amount: 400, status: "active" },
      { currency: "AED", sanctioned_amount: 500, utilised_amount: 100, status: "sanctioned" },
      { currency: "USD", sanctioned_amount: 200, utilised_amount: null, status: "active" },
      { currency: "AED", sanctioned_amount: 900, utilised_amount: 900, status: "cancelled" },
    ]);
    expect(totals).toEqual([
      { currency: "AED", sanctioned: 1500, utilised: 500, headroom: 1000 },
      { currency: "USD", sanctioned: 200, utilised: 0, headroom: 200 },
    ]);
  });
});

describe("labelFor", () => {
  it("maps known values and falls back", () => {
    expect(labelFor(FACILITY_TYPES, "sweep")).toBe("Sweep / Auto-Sweep");
    expect(labelFor(FACILITY_TYPES, "mystery")).toBe("mystery");
    expect(labelFor(FACILITY_TYPES, null)).toBe("—");
  });
});
