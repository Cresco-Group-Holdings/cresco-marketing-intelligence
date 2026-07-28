import { describe, expect, it } from "vitest";
import { calculateKnowledgeReadiness } from "@/lib/brand-knowledge/readiness";
import {
  calculateFoundationReadiness,
  type FoundationReadinessInput,
} from "@/lib/foundation/readiness";

const baseInput = (): FoundationReadinessInput => ({
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
  availableConnectorCount: 0,
  aiProvidersConfigured: 0,
  aiProvidersTotal: 4,
  marketingObjectiveCount: 0,
});

describe("calculateFoundationReadiness", () => {
  it("marks workspace as blocked when no organisation exists", () => {
    const readiness = calculateFoundationReadiness({
      ...baseInput(),
      hasOrganisation: false,
      hasProject: false,
      hasBrand: false,
    });

    expect(readiness.find((item) => item.category === "workspace")?.status).toBe("blocked");
    expect(readiness.find((item) => item.category === "audience")?.status).toBe("blocked");
  });

  it("marks complete workspace when org, project, and brand are selected", () => {
    const readiness = calculateFoundationReadiness(baseInput());
    expect(readiness.find((item) => item.category === "workspace")?.status).toBe("completed");
  });

  it("marks connectors as not yet available when no connectors are available", () => {
    const readiness = calculateFoundationReadiness(baseInput());
    expect(readiness.find((item) => item.category === "connectors")?.status).toBe(
      "not_yet_available",
    );
  });

  it("reflects incomplete audience and objectives when knowledge is empty", () => {
    const emptyKnowledge = calculateKnowledgeReadiness({
      brand: {
        name: "Cresco",
        description: null,
        website: null,
        primaryDomain: null,
        logoUrl: null,
        faviconUrl: null,
        primaryColour: null,
        secondaryColour: null,
        accentColour: null,
      },
      profile: null,
      audiences: [],
      personas: [],
      offers: [],
      messaging: null,
      voice: null,
      competitors: [],
      assets: [],
      references: [],
      complianceRules: [],
    });

    const readiness = calculateFoundationReadiness({
      ...baseInput(),
      knowledgeReadiness: emptyKnowledge,
    });

    expect(readiness.find((item) => item.category === "audience")?.status).toBe("incomplete");
    expect(readiness.find((item) => item.category === "offer")?.status).toBe("incomplete");
    expect(readiness.find((item) => item.category === "marketing_objectives")?.status).toBe(
      "incomplete",
    );
  });

  it("marks AI configuration complete when a provider is configured", () => {
    const readiness = calculateFoundationReadiness({
      ...baseInput(),
      aiProvidersConfigured: 1,
    });

    expect(readiness.find((item) => item.category === "ai_configuration")?.status).toBe("completed");
  });
});
