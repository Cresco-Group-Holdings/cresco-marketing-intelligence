import { describe, expect, it } from "vitest";
import { resolveActivationNextAction } from "@/lib/activation/next-action";
import { buildMilestoneSnapshot } from "@/lib/activation/status";
import { createEmptyMilestoneSnapshot } from "@/lib/activation/status";

function buildMilestones(overrides: Partial<ReturnType<typeof createEmptyMilestoneSnapshot>> = {}) {
  return buildMilestoneSnapshot({
    milestones: { ...createEmptyMilestoneSnapshot(), ...overrides },
    demoModeEnabled: false,
    demoProductExperienced: false,
    onboardingCompleted: true,
    syncInProgress: false,
  });
}

const baseInput = {
  brandId: "brand-1" as string | null,
  onboardingCompleted: true,
  demoModeEnabled: false,
  syncInProgress: false,
  canManageIntegrations: true,
  invitedMember: false,
  workspaceProviderConnected: false,
};

describe("resolveActivationNextAction", () => {
  it("prioritises onboarding when incomplete", () => {
    const action = resolveActivationNextAction({
      status: "in_progress",
      milestones: buildMilestones(),
      ...baseInput,
      onboardingCompleted: false,
    });

    expect(action?.id).toBe("continue-onboarding");
  });

  it("recommends create brand when brand missing", () => {
    const action = resolveActivationNextAction({
      status: "in_progress",
      milestones: buildMilestones({
        organisation_ready: true,
        project_ready: true,
      }),
      ...baseInput,
    });

    expect(action?.id).toBe("create-brand");
  });

  it("recommends brand knowledge before provider connection", () => {
    const action = resolveActivationNextAction({
      status: "in_progress",
      milestones: buildMilestones({
        organisation_ready: true,
        project_ready: true,
        brand_ready: true,
      }),
      ...baseInput,
    });

    expect(action?.id).toBe("add-brand-knowledge");
  });

  it("recommends connect provider when missing", () => {
    const action = resolveActivationNextAction({
      status: "in_progress",
      milestones: buildMilestones({
        organisation_ready: true,
        project_ready: true,
        brand_ready: true,
        minimum_brand_knowledge: true,
      }),
      ...baseInput,
    });

    expect(action?.id).toBe("connect-provider");
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
      ...baseInput,
      syncInProgress: true,
      workspaceProviderConnected: true,
    });

    expect(action?.id).toBe("create-while-syncing");
  });

  it("recommends channel variant when master content exists", () => {
    const action = resolveActivationNextAction({
      status: "in_progress",
      milestones: buildMilestones({
        organisation_ready: true,
        project_ready: true,
        brand_ready: true,
        minimum_brand_knowledge: true,
        first_provider_connected: true,
        initial_sync_complete: true,
        first_content_created: true,
        first_ai_generation_completed: true,
      }),
      ...baseInput,
      workspaceProviderConnected: true,
    });

    expect(action?.id).toBe("create-variant");
  });

  it("recommends schedule publication when variant ready", () => {
    const action = resolveActivationNextAction({
      status: "in_progress",
      milestones: buildMilestones({
        organisation_ready: true,
        project_ready: true,
        brand_ready: true,
        minimum_brand_knowledge: true,
        first_provider_connected: true,
        initial_sync_complete: true,
        first_content_created: true,
        first_variant_created: true,
      }),
      ...baseInput,
      workspaceProviderConnected: true,
    });

    expect(action?.id).toBe("schedule-publication");
  });

  it("recommends review analytics when analytics ready but no insight", () => {
    const action = resolveActivationNextAction({
      status: "ready_for_first_value",
      milestones: buildMilestones({
        organisation_ready: true,
        project_ready: true,
        brand_ready: true,
        minimum_brand_knowledge: true,
        first_provider_connected: true,
        first_analytics_observation: true,
      }),
      ...baseInput,
      workspaceProviderConnected: true,
    });

    expect(action?.id).toBe("review-analytics");
  });

  it("recommends review insight when recommendation available", () => {
    const action = resolveActivationNextAction({
      status: "activated",
      milestones: buildMilestones({
        organisation_ready: true,
        project_ready: true,
        brand_ready: true,
        minimum_brand_knowledge: true,
        first_provider_connected: true,
        first_recommendation_generated: true,
      }),
      ...baseInput,
      workspaceProviderConnected: true,
    });

    expect(action?.id).toBe("review-cresco-insight");
  });

  it("shows provider requires admin for members without permission", () => {
    const action = resolveActivationNextAction({
      status: "in_progress",
      milestones: buildMilestones({
        organisation_ready: true,
        project_ready: true,
        brand_ready: true,
        minimum_brand_knowledge: true,
      }),
      ...baseInput,
      canManageIntegrations: false,
    });

    expect(action?.id).toBe("provider-requires-admin");
  });

  it("skips owner setup for invited members with completed onboarding", () => {
    const action = resolveActivationNextAction({
      status: "in_progress",
      milestones: buildMilestones({
        organisation_ready: true,
        brand_ready: true,
      }),
      ...baseInput,
      canManageIntegrations: false,
      invitedMember: true,
    });

    expect(action?.id).toBe("add-brand-knowledge");
  });
});
