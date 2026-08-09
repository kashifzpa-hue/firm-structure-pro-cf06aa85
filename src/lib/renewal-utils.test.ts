import { describe, expect, it } from "vitest";
import {
  DOC_TYPE_PRESETS,
  calculateNextExpiry,
  getFrequencyLabel,
  getFrequencyMonths,
} from "@/lib/renewal-utils";

describe("getFrequencyMonths", () => {
  it("returns null when the document never renews", () => {
    expect(getFrequencyMonths("none")).toBeNull();
  });

  it("resolves the standard intervals", () => {
    expect(getFrequencyMonths("annual")).toBe(12);
    expect(getFrequencyMonths("biennial")).toBe(24);
    expect(getFrequencyMonths("triennial")).toBe(36);
    expect(getFrequencyMonths("quinquennial")).toBe(60);
    expect(getFrequencyMonths("decennial")).toBe(120);
  });

  it("uses the custom interval only for the custom frequency", () => {
    expect(getFrequencyMonths("custom", 18)).toBe(18);
    expect(getFrequencyMonths("custom", null)).toBeNull();
    expect(getFrequencyMonths("annual", 18)).toBe(12);
  });
});

describe("calculateNextExpiry", () => {
  it("adds the interval to the current expiry date", () => {
    expect(calculateNextExpiry("2026-03-15", "annual")).toBe("2027-03-15");
    expect(calculateNextExpiry("2026-03-15", "biennial")).toBe("2028-03-15");
    expect(calculateNextExpiry("2026-03-15", "custom", 18)).toBe("2027-09-15");
  });

  it("clamps to the last valid day when the target month is shorter", () => {
    expect(calculateNextExpiry("2026-01-31", "custom", 1)).toBe("2026-02-28");
  });

  it("returns null when there is nothing to renew", () => {
    expect(calculateNextExpiry("2026-03-15", "none")).toBeNull();
    expect(calculateNextExpiry("", "annual")).toBeNull();
    expect(calculateNextExpiry("2026-03-15", "custom")).toBeNull();
  });
});

describe("getFrequencyLabel", () => {
  it("renders an em dash for no renewal", () => {
    expect(getFrequencyLabel(null)).toBe("—");
    expect(getFrequencyLabel("none")).toBe("—");
  });

  it("spells out custom intervals", () => {
    expect(getFrequencyLabel("custom", 18)).toBe("Every 18 months");
    expect(getFrequencyLabel("annual")).toBe("Annual");
  });
});

describe("DOC_TYPE_PRESETS", () => {
  it("every preset resolves to a usable interval", () => {
    for (const [docType, preset] of Object.entries(DOC_TYPE_PRESETS)) {
      const months = getFrequencyMonths(preset.frequency, preset.months);
      if (preset.frequency === "none") {
        expect(months, docType).toBeNull();
      } else {
        expect(months, docType).toBeGreaterThan(0);
      }
    }
  });
});
