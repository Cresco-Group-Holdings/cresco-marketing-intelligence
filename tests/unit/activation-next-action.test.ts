import { describe, expect, it } from "vitest";
import { resolveActivationNextAction } from "@/lib/activation/next-action";
import { buildMilestoneSnapshot } from "@/lib/activation/status";
import { createEmptyMilestoneSnapshot } from "@/lib/activation/status";

function buildMilestones(overrides: Partial<ReturnType<typeof createEmptyMilestoneSnapshot>> = {}) {
  return buildMilestoneSnapshot({
    milestones: { ...createEmptyMilestoneSnapshot(), ...overrides },
    demoModeEnabled: false,
    onboardingCompleted: true,
    syncInProgress: false,
  });
}

describe("resolveActivationNextAction", () => {
  it("prioritises onboarding when incomplete", () => {
    const action = resolveActivationNextAction({
      status: "in_progress",
      milestones: buildMilestones(),
      brandId: null,
      onboardingCompleted: false,
      demoModeEnabled: false,
      syncInProgress: false,
      canManageIntegrations: true,
      invitedMember: false,
    });

    expect(action?.id).toBe("continue-onboarding");
  });

  it("recommends brand knowledge before provider connection", () => {
    const action = resolveActivationNextAction({
      status: "in_progress",
      milestones: buildMilestones({
        organisation_ready: true,
        project_ready: true,
        brand_ready: true,
      }),
      brandId: "brand-1",
      onboardingCompleted: true,
      demoModeEnabled: false,
      syncInProgress: false,
      canManageIntegrations: true,
      invitedMember: false,
    });

    expect(action?.id).toBe("add-brand-knowledge");
  });

  it("recommends content creation while sync is running", () => {
    const action = resolveActivationNextAction({
      status: "in_progress",
      milestones: buildMilestones({
        organisation_ready: true,
        project_ready: true,
        brand_ready: true,
        minimum_brand_knowledge: true,
        first_provider_connected: true,
      }),
      brandId: "brand-1",
      onboardingCompleted: true,
      demoModeEnabled: false,
      syncInProgress: true,
      canManageIntegrations: true,
      invitedMember: false,
    });

    expect(action?.id).toBe("create-while-syncing");
  });

  it("skips owner setup for invited members with completed onboarding", () => {
    const action = resolveActivationNextAction({
      status: "in_progress",
      milestones: buildMilestones({
        organisation_ready: true,
        brand_ready: true,
      }),
      brandId: "brand-1",
      onboardingCompleted: true,
      demoModeEnabled: false,
      syncInProgress: false,
      canManageIntegrations: false,
      invitedMember: true,
    });

    expect(action?.id).toBe("add-brand-knowledge");
  });
});
