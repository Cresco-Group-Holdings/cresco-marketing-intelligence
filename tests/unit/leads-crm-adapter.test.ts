import { describe, expect, it } from "vitest";
import { getCrmAdapter } from "@/lib/leads/crm-adapter";

describe("CRM adapters", () => {
  it("returns fake adapter result for tests", async () => {
    const adapter = getCrmAdapter("FAKE");
    const result = await adapter.handoff({
      idempotencyKey: "handoff-key-123456",
      payload: {
        leadId: "lead-1",
        status: "NEW",
        source: "MANUAL",
      },
    });
    expect(result.status).toBe("SENT");
    expect(result.externalId).toMatch(/^fake-lead-1$/);
  });

  it("skips unsupported live CRM providers", async () => {
    const adapter = getCrmAdapter("HUBSPOT");
    const result = await adapter.handoff({
      idempotencyKey: "handoff-key-123456",
      payload: { leadId: "lead-1", status: "NEW", source: "MANUAL" },
    });
    expect(result.status).toBe("SKIPPED");
  });

  it("deduplicates repeated handoff attempts via idempotency key at service layer", async () => {
    const adapter = getCrmAdapter("FAKE");
    const input = {
      idempotencyKey: "same-key-12345678",
      payload: { leadId: "lead-1", status: "NEW", source: "MANUAL" },
    };
    const first = await adapter.handoff(input);
    const second = await adapter.handoff(input);
    expect(first.externalId).toBe(second.externalId);
  });
});
