import { describe, expect, it } from "vitest";
import { generateFoundationNextActions } from "@/lib/foundation/next-actions";
import { calculateFoundationReadiness } from "@/lib/foundation/readiness";

describe("generateFoundationNextActions", () => {
  it("prioritises onboarding when incomplete", () => {
    const readiness = calculateFoundationReadiness({
      hasOrganisation: true,
      hasProject: true,
      hasBrand: true,
      onboardingCompleted: false,
      brandProfileComplete: false,
      knowledgeReadiness: null,
      marketingAssetCount: 0,
      approvedMarketingAssetCount: 0,
      hasLogo: false,
      connectedConnectorCount: 0,
      availableConnectorCount: 0,
      aiProvidersConfigured: 0,
      aiProvidersTotal: 4,
      marketingObjectiveCount: 0,
    });

    const actions = generateFoundationNextActions({
      readiness,
      hasBrand: true,
      brandId: "brand-1",
      onboardingCompleted: false,
      hasLogo: false,
      hasApprovedCta: false,
      aiProvidersConfigured: 0,
      connectedConnectorCount: 0,
      availableConnectorCount: 0,
    });

    expect(actions[0]?.id).toBe("complete-onboarding");
  });

  it("suggests audience, offer, logo, CTA, AI, and connector actions", () => {
    const readiness = calculateFoundationReadiness({
      hasOrganisation: true,
      hasProject: true,
      hasBrand: true,
      onboardingCompleted: true,
      brandProfileComplete: false,
      knowledgeReadiness: null,
      marketingAssetCount: 0,
      approvedMarketingAssetCount: 0,
      hasLogo: false,
      connectedConnectorCount: 0,
      availableConnectorCount: 1,
      aiProvidersConfigured: 0,
      aiProvidersTotal: 4,
      marketingObjectiveCount: 0,
    });

    const actions = generateFoundationNextActions({
      readiness,
      hasBrand: true,
      brandId: "brand-1",
      onboardingCompleted: true,
      hasLogo: false,
      hasApprovedCta: false,
      aiProvidersConfigured: 0,
      connectedConnectorCount: 0,
      availableConnectorCount: 1,
    });

    const ids = actions.map((action) => action.id);
    expect(ids).toContain("complete-audience");
    expect(ids).toContain("add-offer");
    expect(ids).toContain("upload-logo");
    expect(ids).toContain("add-cta");
    expect(ids).toContain("configure-ai");
    expect(ids).toContain("connect-data-source");
    expect(ids).toContain("add-objective");
  });

  it("does not include fake metric recommendations", () => {
    const readiness = calculateFoundationReadiness({
      hasOrganisation: true,
      hasProject: true,
      hasBrand: true,
      onboardingCompleted: true,
      brandProfileComplete: true,
      knowledgeReadiness: null,
      marketingAssetCount: 5,
      approvedMarketingAssetCount: 5,
      hasLogo: true,
      connectedConnectorCount: 2,
      availableConnectorCount: 2,
      aiProvidersConfigured: 2,
      aiProvidersTotal: 4,
      marketingObjectiveCount: 3,
    });

    const actions = generateFoundationNextActions({
      readiness,
      hasBrand: true,
      brandId: "brand-1",
      onboardingCompleted: true,
      hasLogo: true,
      hasApprovedCta: true,
      aiProvidersConfigured: 2,
      connectedConnectorCount: 2,
      availableConnectorCount: 2,
    });

    expect(actions.every((action) => !/traffic|revenue|roi|leads/i.test(action.title))).toBe(true);
  });
});
