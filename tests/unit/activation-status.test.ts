import { describe, expect, it } from "vitest";
import { buildActivationChecklist } from "@/lib/activation/checklist";
import { buildMilestoneSnapshot, calculateActivationStatus } from "@/lib/activation/status";
import { createEmptyMilestoneSnapshot } from "@/lib/activation/status";

describe("activation status", () => {
  it("returns not_started before any milestones", () => {
    const result = calculateActivationStatus({
      milestones: createEmptyMilestoneSnapshot(),
      demoModeEnabled: false,
      demoProductExperienced: false,
      onboardingCompleted: false,
      syncInProgress: false,
    });

    expect(result.status).toBe("not_started");
    expect(result.isActivated).toBe(false);
  });

  it("marks activated when foundation, knowledge, data source, and value action exist", () => {
    const milestones = createEmptyMilestoneSnapshot();
    milestones.organisation_ready = true;
    milestones.project_ready = true;
    milestones.brand_ready = true;
    milestones.minimum_brand_knowledge = true;
    milestones.first_provider_connected = true;
    milestones.first_ai_generation_completed = true;

    const result = calculateActivationStatus({
      milestones,
      demoModeEnabled: false,
      demoProductExperienced: false,
      onboardingCompleted: true,
      syncInProgress: false,
    });

    expect(result.isActivated).toBe(true);
    expect(result.status).toBe("activated");
  });

  it("does not activate from demo mode without real domain milestones", () => {
    const milestones = createEmptyMilestoneSnapshot();
    milestones.organisation_ready = true;
    milestones.project_ready = true;
    milestones.brand_ready = true;
    milestones.minimum_brand_knowledge = true;

    const result = calculateActivationStatus({
      milestones,
      demoModeEnabled: true,
      demoProductExperienced: true,
      onboardingCompleted: true,
      syncInProgress: false,
    });

    expect(result.isActivated).toBe(false);
    expect(result.demoProductExperienced).toBe(true);
  });

  it("counts essential milestones for progress indicator", () => {
    const milestones = createEmptyMilestoneSnapshot();
    milestones.organisation_ready = true;
    milestones.brand_ready = true;

    const result = calculateActivationStatus({
      milestones,
      demoModeEnabled: false,
      demoProductExperienced: false,
      onboardingCompleted: true,
      syncInProgress: false,
    });

    expect(result.essentialCompleted).toBe(2);
    expect(result.essentialTotal).toBe(7);
  });

  it("marks sync milestone as in progress on checklist", () => {
    const milestones = createEmptyMilestoneSnapshot();
    milestones.first_provider_connected = true;

    const snapshot = buildMilestoneSnapshot({
      milestones,
      demoModeEnabled: false,
      demoProductExperienced: false,
      onboardingCompleted: true,
      syncInProgress: true,
    });

    const connectMilestone = snapshot.find((item) => item.key === "first_provider_connected");
    expect(connectMilestone?.inProgress).toBe(true);
  });
});

describe("activation checklist", () => {
  it("separates essential and optional items", () => {
    const milestones = buildMilestoneSnapshot({
      milestones: createEmptyMilestoneSnapshot(),
      demoModeEnabled: false,
      demoProductExperienced: false,
      onboardingCompleted: true,
      syncInProgress: false,
    });

    const checklist = buildActivationChecklist({
      milestones,
      brandId: "brand-1",
      canManageIntegrations: true,
      demoModeEnabled: false,
      workspaceProviderConnected: false,
      syncInProgress: false,
    });

    expect(checklist.essential).toHaveLength(7);
    expect(checklist.optional.length).toBeGreaterThan(0);
  });

  it("marks provider complete for members when workspace already connected", () => {
    const milestones = buildMilestoneSnapshot({
      milestones: {
        ...createEmptyMilestoneSnapshot(),
        first_provider_connected: true,
      },
      demoModeEnabled: false,
      demoProductExperienced: false,
      onboardingCompleted: true,
      syncInProgress: false,
    });

    const checklist = buildActivationChecklist({
      milestones,
      brandId: "brand-1",
      canManageIntegrations: false,
      demoModeEnabled: false,
      workspaceProviderConnected: true,
      syncInProgress: false,
    });

    const connectItem = checklist.essential.find((item) => item.id === "first_provider_connected");
    expect(connectItem?.status).toBe("complete");
    expect(checklist.essentialCompleted).toBe(1);
  });

  it("shows requires_admin without inflating completion count", () => {
    const milestones = buildMilestoneSnapshot({
      milestones: createEmptyMilestoneSnapshot(),
      demoModeEnabled: false,
      demoProductExperienced: false,
      onboardingCompleted: true,
      syncInProgress: false,
    });

    const checklist = buildActivationChecklist({
      milestones,
      brandId: "brand-1",
      canManageIntegrations: false,
      demoModeEnabled: false,
      workspaceProviderConnected: false,
      syncInProgress: false,
    });

    const connectItem = checklist.essential.find((item) => item.id === "first_provider_connected");
    expect(connectItem?.status).toBe("requires_admin");
    expect(checklist.essentialCompleted).toBe(0);
  });
});
