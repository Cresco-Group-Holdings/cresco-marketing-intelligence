import { describe, expect, it } from "vitest";
import { canMarketToLead, minimiseLeadExport, redactDeletedLead } from "@/lib/leads/privacy";

describe("lead privacy helpers", () => {
  it("minimises export fields by scope", () => {
    const record = {
      displayName: "Alex",
      email: "alex@example.com",
      phone: "+44123456789",
      originalInteraction: "Can you help with grants?",
    };
    expect(minimiseLeadExport(record, "SUMMARY")).not.toHaveProperty("email");
    expect(minimiseLeadExport(record, "CRM")).toHaveProperty("email");
    expect(minimiseLeadExport(record, "FULL")).toHaveProperty("originalInteraction");
  });

  it("blocks marketing when suppressed or without opt-in", () => {
    expect(
      canMarketToLead({ retentionStatus: "ACTIVE", marketingOptIn: false, suppressed: false }),
    ).toBe(false);
    expect(
      canMarketToLead({ retentionStatus: "SUPPRESSED", marketingOptIn: true, suppressed: true }),
    ).toBe(false);
    expect(
      canMarketToLead({ retentionStatus: "ACTIVE", marketingOptIn: true, suppressed: false }),
    ).toBe(true);
  });

  it("redacts deleted lead personal data", () => {
    expect(redactDeletedLead().email).toBeNull();
    expect(redactDeletedLead().displayName).toBe("[deleted]");
  });
});
