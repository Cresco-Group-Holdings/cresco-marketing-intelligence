import { describe, expect, it } from "vitest";
import {
  readLeadIdFromPayload,
  readStoredPayload,
  toInputJsonValue,
} from "@/lib/domain-events/payload";

describe("domain event payload helpers", () => {
  it("serializes payloads for Prisma JSON columns", () => {
    const value = toInputJsonValue({
      leadId: "lead-1",
      nested: { score: 42 },
    });

    expect(value).toEqual({
      leadId: "lead-1",
      nested: { score: 42 },
    });
  });

  it("reads leadId from stored payload when present", () => {
    expect(readLeadIdFromPayload({ leadId: "lead-42" }, "resource-fallback")).toBe("lead-42");
    expect(readLeadIdFromPayload({ leadId: 99 }, "resource-fallback")).toBe("99");
  });

  it("falls back to resourceId when leadId is unavailable", () => {
    expect(readStoredPayload(null)).toEqual({});
    expect(readLeadIdFromPayload({}, "resource-1")).toBe("resource-1");
    expect(readLeadIdFromPayload({ leadId: null }, "resource-1")).toBe("resource-1");
  });
});
