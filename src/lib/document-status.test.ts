import { describe, expect, it } from "vitest";
import { addDays, format, subDays } from "date-fns";
import { getDocumentStatus, getStatusLabel, getStatusVariant } from "@/lib/document-status";

const iso = (d: Date) => format(d, "yyyy-MM-dd");
const today = new Date();

describe("getDocumentStatus", () => {
  it("treats a missing expiry date as valid (perpetual document)", () => {
    expect(getDocumentStatus(null)).toBe("valid");
    expect(getDocumentStatus(undefined)).toBe("valid");
    expect(getDocumentStatus("")).toBe("valid");
  });

  it("treats an unparseable date as valid rather than throwing", () => {
    expect(getDocumentStatus("not-a-date")).toBe("valid");
  });

  it("flags past dates as expired", () => {
    expect(getDocumentStatus(iso(subDays(today, 1)))).toBe("expired");
    expect(getDocumentStatus(iso(subDays(today, 400)))).toBe("expired");
  });

  it("treats today as expiring soon, not expired", () => {
    expect(getDocumentStatus(iso(today))).toBe("expiring_soon");
  });

  it("uses a 30-day expiring-soon window, inclusive of day 30", () => {
    expect(getDocumentStatus(iso(addDays(today, 29)))).toBe("expiring_soon");
    expect(getDocumentStatus(iso(addDays(today, 30)))).toBe("expiring_soon");
    expect(getDocumentStatus(iso(addDays(today, 31)))).toBe("valid");
  });
});

describe("status presentation", () => {
  it("maps every status to a label and badge variant", () => {
    expect(getStatusLabel("expired")).toBe("Expired");
    expect(getStatusLabel("expiring_soon")).toBe("Expiring Soon");
    expect(getStatusLabel("valid")).toBe("Valid");

    expect(getStatusVariant("expired")).toBe("destructive");
    expect(getStatusVariant("expiring_soon")).toBe("warning");
    expect(getStatusVariant("valid")).toBe("success");
  });
});
