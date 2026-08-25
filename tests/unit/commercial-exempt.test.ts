import { describe, expect, it } from "vitest";
import { isCommercialUsageExempt, COMMERCIAL_EXEMPT_ORGANISATION_IDS } from "@/lib/billing/commercial-exempt";

describe("commercial usage exemption", () => {
  it("marks preview/demo organisation IDs as exempt", () => {
    expect(COMMERCIAL_EXEMPT_ORGANISATION_IDS.has("org-preview")).toBe(true);
    expect(isCommercialUsageExempt("org-preview")).toBe(true);
    expect(isCommercialUsageExempt("org-demo")).toBe(true);
  });

  it("does not exempt production organisations", () => {
    expect(isCommercialUsageExempt("org-production-123")).toBe(false);
    expect(isCommercialUsageExempt(null)).toBe(false);
  });
});
