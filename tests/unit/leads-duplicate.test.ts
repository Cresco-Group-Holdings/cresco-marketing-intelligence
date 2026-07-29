import { describe, expect, it } from "vitest";
import { findDuplicateLead } from "@/lib/leads/duplicate-detection";

describe("findDuplicateLead", () => {
  const candidates = [
    {
      id: "lead-1",
      email: "alex@example.com",
      phone: null,
      providerUsername: "alex_biz",
      sourcePlatform: "LINKEDIN" as const,
    },
  ];

  it("matches duplicate email", () => {
    expect(
      findDuplicateLead(candidates, { email: "Alex@example.com" })?.id,
    ).toBe("lead-1");
  });

  it("matches duplicate username on same platform", () => {
    expect(
      findDuplicateLead(candidates, {
        providerUsername: "@alex_biz",
        sourcePlatform: "LINKEDIN",
      })?.id,
    ).toBe("lead-1");
  });

  it("returns null when no duplicate exists", () => {
    expect(findDuplicateLead(candidates, { email: "other@example.com" })).toBeNull();
  });
});
