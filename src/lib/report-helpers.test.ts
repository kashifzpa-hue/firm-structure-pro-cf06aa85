import { describe, expect, it } from "vitest";
import { addDays, format, subDays } from "date-fns";
import {
  buildOwnershipChainLabel,
  formatReportDate,
  getDaysInfo,
  getDocStatusLabel,
  sanitizeFilename,
} from "@/lib/report-helpers";

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const today = new Date();

describe("formatReportDate", () => {
  it("formats ISO dates for regulator-facing output", () => {
    expect(formatReportDate("2026-03-05")).toBe("05 Mar 2026");
  });

  it("never renders an empty or invalid date silently", () => {
    expect(formatReportDate(null)).toBe("[Not recorded]");
    expect(formatReportDate("")).toBe("[Not recorded]");
    expect(formatReportDate("garbage")).toBe("[Not recorded]");
  });
});

describe("getDocStatusLabel", () => {
  it("matches the app-wide 30-day expiry window", () => {
    expect(getDocStatusLabel(iso(subDays(today, 1)))).toBe("[EXPIRED]");
    expect(getDocStatusLabel(iso(today))).toBe("[EXPIRING]");
    expect(getDocStatusLabel(iso(addDays(today, 30)))).toBe("[EXPIRING]");
    expect(getDocStatusLabel(iso(addDays(today, 31)))).toBe("[VALID]");
    expect(getDocStatusLabel(null)).toBe("[VALID]");
  });
});

describe("getDaysInfo", () => {
  it("reports overdue and remaining days", () => {
    expect(getDaysInfo(iso(subDays(today, 3)))).toBe("3 days overdue");
    expect(getDaysInfo(iso(addDays(today, 10)))).toBe("10 days remaining");
    expect(getDaysInfo(iso(today))).toBe("0 days remaining");
    expect(getDaysInfo(null)).toBe("—");
  });
});

describe("buildOwnershipChainLabel", () => {
  const node = (entity_name: string) => ({ entity_name });

  it("labels a two-node chain as direct ownership", () => {
    expect(buildOwnershipChainLabel([node("Jane Doe"), node("Holding A")])).toBe("Direct");
  });

  it("lists the intermediaries of an indirect chain in order", () => {
    const chain = [node("Jane Doe"), node("Midco 1"), node("Midco 2"), node("Holding A")];
    expect(buildOwnershipChainLabel(chain)).toBe("Via Midco 1 → Midco 2");
  });

  it("handles missing chains", () => {
    expect(buildOwnershipChainLabel([])).toBe("[Not recorded]");
    expect(buildOwnershipChainLabel(null as unknown as unknown[])).toBe("[Not recorded]");
  });
});

describe("sanitizeFilename", () => {
  it("collapses unsafe characters into single underscores", () => {
    expect(sanitizeFilename("Gulf Holdings L.L.C.")).toBe("Gulf_Holdings_L_L_C_");
    expect(sanitizeFilename("a//b")).toBe("a_b");
  });
});
