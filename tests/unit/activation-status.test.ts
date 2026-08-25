import { describe, expect, it } from "vitest";
import { buildActivationChecklist } from "@/lib/activation/checklist";
import { buildMilestoneSnapshot, calculateActivationStatus } from "@/lib/activation/status";
import { createEmptyMilestoneSnapshot } from "@/lib/activation/status";

describe("activation status", () => {
  it("returns not_started before any milestones", () => {
    const result = calculateActivationStatus({
      milestones: createEmptyMilestoneSnapshot(),
      demoModeEnabled: false,
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
      onboardingCompleted: true,
      syncInProgress: false,
    });

    expect(result.isActivated).toBe(true);
    expect(result.status).toBe("activated");
  });

  it("counts essential milestones for progress indicator", () => {
    const milestones = createEmptyMilestoneSnapshot();
    milestones.organisation_ready = true;
    milestones.brand_ready = true;

    const result = calculateActivationStatus({
      milestones,
      demoModeEnabled: false,
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
      onboardingCompleted: true,
      syncInProgress: false,
    });

    const checklist = buildActivationChecklist({
      milestones,
      brandId: "brand-1",
      canManageIntegrations: true,
      demoModeEnabled: false,
    });

    expect(checklist.essential).toHaveLength(7);
    expect(checklist.optional.length).toBeGreaterThan(0);
  });
});
