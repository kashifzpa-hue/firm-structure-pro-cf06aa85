import { describe, expect, it } from "vitest";
import { formatLimit, getAuthorityLabels, maskAccountNumber, maskIban } from "@/lib/banking-utils";
import { getAvatarColor, getInitials } from "@/lib/entity-avatar";

describe("account masking", () => {
  it("shows only the last four characters", () => {
    expect(maskAccountNumber("1234567890")).toBe("••••7890");
    expect(maskIban("AE070331234567890123456")).toBe("••••3456");
  });

  it("leaves short values untouched and handles blanks", () => {
    expect(maskAccountNumber("890")).toBe("890");
    expect(maskAccountNumber(null)).toBe("—");
    expect(maskIban(undefined)).toBe("—");
  });
});

describe("formatLimit", () => {
  it("treats a missing amount as unlimited authority", () => {
    expect(formatLimit(null)).toBe("Unlimited");
    expect(formatLimit(undefined)).toBe("Unlimited");
  });

  it("keeps a zero limit distinct from unlimited", () => {
    expect(formatLimit(0)).toBe("AED 0");
  });

  it("formats amounts with the given currency", () => {
    expect(formatLimit(1500000)).toBe("AED 1,500,000");
    expect(formatLimit(2500, "USD")).toBe("USD 2,500");
  });
});

describe("getAuthorityLabels", () => {
  it("collapses to a single All when full authority is granted", () => {
    expect(getAuthorityLabels(["all", "payments"])).toEqual(["All"]);
  });

  it("maps known values and passes unknown ones through", () => {
    expect(getAuthorityLabels(["payments", "fx"])).toEqual(["Payments", "FX Transactions"]);
    expect(getAuthorityLabels(["mystery"])).toEqual(["mystery"]);
  });
});

describe("entity avatars", () => {
  it("derives initials from first and last name parts", () => {
    expect(getInitials("Jane Doe")).toBe("JD");
    expect(getInitials("Gulf Holdings LLC")).toBe("GL");
    expect(getInitials("  spaced   out  ")).toBe("SO");
    expect(getInitials("Cher")).toBe("C");
    expect(getInitials("   ")).toBe("?");
  });

  it("assigns a stable colour per entity id", () => {
    const id = "8f1c2a9e-0000-4000-8000-000000000001";
    expect(getAvatarColor(id)).toBe(getAvatarColor(id));
    expect(getAvatarColor(id)).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
