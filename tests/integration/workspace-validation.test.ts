import { describe, expect, it } from "vitest";
import { workspaceUpdateSchema } from "@/lib/validation/workspace";

describe("workspace selection validation", () => {
  it("accepts valid workspace update payloads", () => {
    const parsed = workspaceUpdateSchema.parse({
      completeOnboarding: true,
      onboardingStep: "profile",
    });

    expect(parsed.completeOnboarding).toBe(true);
  });

  it("rejects invalid cuid values", () => {
    expect(() =>
      workspaceUpdateSchema.parse({ currentOrganisationId: "not-a-cuid" }),
    ).toThrow();
  });
});
