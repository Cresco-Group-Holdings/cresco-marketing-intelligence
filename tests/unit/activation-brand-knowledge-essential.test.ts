import { describe, expect, it } from "vitest";
import {
  evaluateEssentialBrandKnowledge,
  evaluateRecommendedBrandKnowledge,
} from "@/lib/activation/brand-knowledge-essential";
import type { BrandKnowledgeSnapshot } from "@/lib/brand-knowledge/readiness";

function buildSnapshot(overrides: Partial<BrandKnowledgeSnapshot> = {}): BrandKnowledgeSnapshot {
  return {
    brand: {
      name: "Cresco",
      description: "Marketing intelligence",
      website: "https://cresco.example",
      primaryDomain: "cresco.example",
      logoUrl: null,
      faviconUrl: null,
      primaryColour: null,
      secondaryColour: null,
      accentColour: null,
      ...overrides.brand,
    },
    profile: {
      id: "profile-1",
      brandId: "brand-1",
      shortDescription: "Short description",
      longDescription: null,
      mission: null,
      valueProposition: null,
      complianceNotes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides.profile,
    } as BrandKnowledgeSnapshot["profile"],
    audiences: overrides.audiences ?? [{ id: "aud-1", name: "Founders", description: null, countries: [], painPoints: [], archivedAt: null } as never],
    personas: overrides.personas ?? [],
    offers: overrides.offers ?? [{ id: "offer-1", name: "Platform", shortDescription: "SaaS", benefits: [], primaryCta: "Start", archivedAt: null } as never],
    messaging: {
      id: "msg-1",
      brandId: "brand-1",
      elevatorPitch: null,
      coreMessage: "Grow with evidence",
      supportingMessages: [],
      proofPoints: [],
      differentiators: [],
      ctaLibrary: [],
      prohibitedClaims: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides.messaging,
    } as BrandKnowledgeSnapshot["messaging"],
    voice: {
      id: "voice-1",
      brandId: "brand-1",
      preferredTone: "Confident and clear",
      vocabulary: [],
      prohibitedVocabulary: [],
      sentenceStyle: null,
      emojiPolicy: null,
      approvedExamples: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides.voice,
    } as BrandKnowledgeSnapshot["voice"],
    competitors: overrides.competitors ?? [],
    assets: overrides.assets ?? [],
    references: overrides.references ?? [],
    complianceRules: overrides.complianceRules ?? [],
  };
}

describe("activation brand knowledge essential", () => {
  it("marks essential tier complete when core fields exist", () => {
    const result = evaluateEssentialBrandKnowledge(buildSnapshot());
    expect(result.complete).toBe(true);
    expect(result.filled).toBe(5);
  });

  it("marks essential tier incomplete when voice is missing", () => {
    const result = evaluateEssentialBrandKnowledge(
      buildSnapshot({ voice: { preferredTone: "" } as never }),
    );
    expect(result.complete).toBe(false);
    expect(result.filled).toBe(4);
  });

  it("reports recommended tier progress separately", () => {
    const result = evaluateRecommendedBrandKnowledge(buildSnapshot());
    expect(result.complete).toBe(false);
    expect(result.total).toBe(8);
  });
});
