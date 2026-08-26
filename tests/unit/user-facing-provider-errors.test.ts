import { describe, expect, it } from "vitest";
import { mapOAuthErrorToUserMessage } from "@/lib/providers/user-facing-errors";

describe("user-facing provider errors", () => {
  it("maps invalid_grant to reconnect CTA", () => {
    const result = mapOAuthErrorToUserMessage("linkedin", "invalid_grant");
    expect(result.ctaAction).toBe("reconnect");
    expect(result.message).toContain("LinkedIn");
    expect(result.message).not.toContain("invalid_grant");
  });

  it("maps access_denied to retry CTA", () => {
    const result = mapOAuthErrorToUserMessage("google-analytics", "access_denied");
    expect(result.ctaAction).toBe("retry");
    expect(result.title).toBe("Connection cancelled");
  });
});
