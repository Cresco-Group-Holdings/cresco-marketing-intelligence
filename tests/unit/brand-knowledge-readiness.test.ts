import { describe, expect, it } from "vitest";
import {
  buildKnowledgeSummary,
  calculateKnowledgeReadiness,
  type BrandKnowledgeSnapshot,
} from "@/lib/brand-knowledge/readiness";

const emptySnapshot = (): BrandKnowledgeSnapshot => ({
  brand: {
    name: "Cresco Grants",
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

describe("calculateKnowledgeReadiness", () => {
  it("returns deterministic scores for an empty knowledge base", () => {
    const result = calculateKnowledgeReadiness(emptySnapshot());

    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.categories).toHaveLength(7);
    expect(result.categories.map((category) => category.category)).toEqual([
      "identity",
      "audience",
      "offer",
      "messaging",
      "voice",
      "compliance",
      "assets",
    ]);
    expect(result.summary).toContain("need attention");
  });

  it("increases score when recommended fields are populated", () => {
    const empty = calculateKnowledgeReadiness(emptySnapshot());
    const populated = calculateKnowledgeReadiness({
      ...emptySnapshot(),
      brand: {
        ...emptySnapshot().brand,
        description: "Grant support for UK charities",
        website: "https://example.com",
        logoUrl: "https://example.com/logo.png",
        primaryColour: "#112233",
      },
      profile: {
        id: "profile-1",
        organisationId: "org-1",
        projectId: "project-1",
        brandId: "brand-1",
        shortDescription: "Short",
        longDescription: null,
        mission: null,
        valueProposition: "Helping charities secure funding",
        targetAudience: null,
        customerProblems: null,
        keyBenefits: null,
        productsAndServices: null,
        preferredTone: null,
        prohibitedTone: null,
        preferredLanguage: null,
        targetCountries: [],
        targetIndustries: [],
        competitors: [],
        complianceNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      audiences: [
        {
          id: "aud-1",
          organisationId: "org-1",
          projectId: "project-1",
          brandId: "brand-1",
          name: "Charity founders",
          description: "Early-stage charity leaders",
          countries: ["GB"],
          industries: ["Nonprofit"],
          organisationType: "Charity",
          companySize: "1-10",
          jobRoles: ["Founder"],
          painPoints: ["Grant complexity"],
          motivations: ["Funding"],
          objections: ["Cost"],
          buyingTriggers: ["New grant round"],
          preferredChannels: ["EMAIL"],
          createdAt: new Date(),
          updatedAt: new Date(),
          archivedAt: null,
        },
      ],
      personas: [
        {
          id: "persona-1",
          organisationId: "org-1",
          projectId: "project-1",
          brandId: "brand-1",
          name: "Charity founder",
          description: null,
          roleTitle: "Founder",
          goals: [],
          painPoints: [],
          motivations: [],
          objections: [],
          buyingTriggers: [],
          preferredChannels: [],
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          archivedAt: null,
        },
      ],
      offers: [
        {
          id: "offer-1",
          organisationId: "org-1",
          projectId: "project-1",
          brandId: "brand-1",
          name: "Grant application support",
          shortDescription: "Support with applications",
          features: [],
          benefits: ["Faster submissions"],
          priceDescription: null,
          trialAvailable: false,
          primaryCta: "Book a call",
          landingPageUrl: null,
          eligibilityRestrictions: null,
          availabilityStatus: "AVAILABLE",
          createdAt: new Date(),
          updatedAt: new Date(),
          archivedAt: null,
        },
      ],
      messaging: {
        id: "msg-1",
        organisationId: "org-1",
        projectId: "project-1",
        brandId: "brand-1",
        elevatorPitch: "We help charities win grants.",
        coreMessage: "Expert grant support",
        supportingMessages: [],
        proofPoints: ["100+ applications"],
        differentiators: ["Sector expertise"],
        objectionResponses: null,
        ctaLibrary: [],
        prohibitedClaims: ["Guaranteed funding"],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      voice: {
        id: "voice-1",
        organisationId: "org-1",
        projectId: "project-1",
        brandId: "brand-1",
        preferredTone: "Professional and supportive",
        vocabulary: ["grant", "impact"],
        prohibitedVocabulary: ["guarantee"],
        sentenceStyle: null,
        emojiPolicy: null,
        humourPolicy: null,
        preferredSpelling: "en-GB",
        languageVariants: [],
        approvedExamples: ["We support charities to apply with confidence."],
        unacceptableExamples: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      complianceRules: [
        {
          id: "rule-1",
          organisationId: "org-1",
          projectId: "project-1",
          brandId: "brand-1",
          ruleType: "PROHIBITED_CLAIM",
          title: "No guaranteed funding",
          description: null,
          ruleText: "Never claim guaranteed grant success.",
          severity: "CRITICAL",
          appliesTo: ["WEBSITE"],
          createdAt: new Date(),
          updatedAt: new Date(),
          archivedAt: null,
        },
      ],
      assets: [
        {
          id: "asset-1",
          organisationId: "org-1",
          projectId: "project-1",
          brandId: "brand-1",
          assetType: "LOGO",
          name: "Primary logo",
          description: null,
          fileUrl: null,
          mimeType: null,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          archivedAt: null,
        },
      ],
    });

    expect(populated.overallScore).toBeGreaterThan(empty.overallScore);
    expect(populated.categories.find((category) => category.category === "audience")?.score).toBeGreaterThan(0);
  });

  it("excludes archived records from readiness calculations", () => {
    const snapshot = emptySnapshot();
    snapshot.audiences = [
      {
        id: "aud-archived",
        organisationId: "org-1",
        projectId: "project-1",
        brandId: "brand-1",
        name: "Archived audience",
        description: "Should not count",
        countries: ["GB"],
        industries: [],
        organisationType: null,
        companySize: null,
        jobRoles: [],
        painPoints: [],
        motivations: [],
        objections: [],
        buyingTriggers: [],
        preferredChannels: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: new Date(),
      },
    ];

    const result = calculateKnowledgeReadiness(snapshot);
    const audienceCategory = result.categories.find((category) => category.category === "audience");
    expect(audienceCategory?.missing.some((field) => field.field === "audiences")).toBe(true);
  });
});

describe("buildKnowledgeSummary", () => {
  it("returns a human-readable summary with counts and recommendations", () => {
    const readiness = calculateKnowledgeReadiness(emptySnapshot());
    const summary = buildKnowledgeSummary(emptySnapshot(), readiness);

    expect(summary).toContain("Brand: Cresco Grants");
    expect(summary).toContain("Readiness:");
    expect(summary).toContain("Audiences: 0");
    expect(summary).toContain("Recommended next fields:");
  });
});
