import { describe, expect, it } from "vitest";
import { evaluateBrandAlignment } from "@/lib/content-intelligence/brand-alignment";
import { contentBriefSchema, parseBriefFromMetadata } from "@/lib/content-intelligence/brief";
import { detectContentDuplication } from "@/lib/content-intelligence/duplication";
import { buildContentOpportunities } from "@/lib/content-intelligence/opportunities";
import {
  aggregateThemePerformance,
  classifyContentPerformance,
} from "@/lib/content-intelligence/performance";
import { evaluateContentQuality } from "@/lib/content-intelligence/quality-check";
import { buildNextContentRecommendation } from "@/lib/content-intelligence/recommendations";
import { contentIntelligenceBriefOutputSchema } from "@/lib/ai/content-output-schemas";
import { unavailableValue } from "@/lib/marketing-intelligence/format";

const BRAND_CONTEXT = {
  brandName: "Cresco",
  shortDescription: "Grant advisory",
  valueProposition: "Simplify grant applications",
  mission: null,
  targetAudience: "Founders",
  keyBenefits: null,
  preferredTone: "Professional",
  prohibitedTone: null,
  coreMessage: "Expert funding guidance",
  tagline: null,
  audiences: [{ id: "a1", name: "Startup founders", description: null }],
  personas: [],
  offers: [{ id: "o1", name: "Grants Advisory", description: null }],
  competitors: [],
  prohibitedClaims: ["guaranteed funding"],
  mandatoryDisclosures: [],
  prohibitedVocabulary: ["guaranteed"],
};

describe("content brief", () => {
  it("validates structured brief input", () => {
    const parsed = contentBriefSchema.safeParse({
      mode: "manual",
      objective: "education",
      keyMessage: "Test message",
      supportingMessages: [],
      proofPoints: [],
      differentiators: [],
      cta: "Learn more",
      channelStrategy: ["LINKEDIN"],
      suggestedFormats: ["carousel"],
      prohibitedClaims: [],
      evidenceNotes: [],
    });
    expect(parsed.success).toBe(true);
  });

  it("round-trips brief metadata", () => {
    const brief = {
      mode: "opportunity" as const,
      objective: "lead_generation" as const,
      keyMessage: "Key",
      supportingMessages: [],
      proofPoints: [],
      differentiators: [],
      cta: "Act",
      channelStrategy: [],
      suggestedFormats: [],
      prohibitedClaims: [],
      evidenceNotes: [],
    };
    const restored = parseBriefFromMetadata(brief);
    expect(restored?.keyMessage).toBe("Key");
  });
});

describe("AI structured output validation", () => {
  it("accepts valid intelligence brief output", () => {
    const result = contentIntelligenceBriefOutputSchema.safeParse({
      objective: "education",
      audienceSummary: "Startup founders",
      keyMessage: "SEIS delays are preventable",
      supportingMessages: ["Documentation matters"],
      proofPoints: ["Observed patterns"],
      differentiators: ["Workflow clarity"],
      cta: "Check eligibility",
      channelStrategy: ["LINKEDIN"],
      suggestedFormats: ["carousel"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects malformed brief output", () => {
    const result = contentIntelligenceBriefOutputSchema.safeParse({ keyMessage: "" });
    expect(result.success).toBe(false);
  });
});

describe("brand alignment", () => {
  it("evaluates only dimensions with brand knowledge", () => {
    const result = evaluateBrandAlignment(
      {
        body: "Expert funding guidance for founders. Avoid guaranteed outcomes.",
        hook: "Founders face delays",
        cta: "Check eligibility",
        keyPoints: ["Documentation", "Structure"],
      },
      BRAND_CONTEXT,
    );
    expect(result.disclaimer).toContain("not causal");
    expect(result.dimensions.length).toBeGreaterThan(0);
  });

  it("flags prohibited vocabulary", () => {
    const result = evaluateBrandAlignment(
      {
        body: "We offer guaranteed funding for all startups.",
        keyPoints: [],
      },
      BRAND_CONTEXT,
    );
    const vocab = result.dimensions.find((d) => d.key === "vocabulary");
    expect(vocab?.state).toBe("weak");
  });
});

describe("content opportunities", () => {
  it("creates brief CTA from winning content", () => {
    const opps = buildContentOpportunities({
      winningContent: [
        {
          id: "w1",
          title: "Winner post",
          channel: "LinkedIn",
          liftLabel: "2.1×",
          evidenceStrength: "strong",
        },
      ],
    });
    expect(opps[0]?.action.label).toBe("Create brief");
    expect(opps[0]?.action.href).toContain("winning");
  });

  it("does not fabricate competitor gaps without data", () => {
    const opps = buildContentOpportunities({});
    expect(opps).toEqual([]);
  });
});

describe("performance classification", () => {
  it("returns insufficient_data with small sample", () => {
    expect(classifyContentPerformance(0.05, 0.03, 1)).toBe("insufficient_data");
  });

  it("classifies winning content above baseline", () => {
    expect(classifyContentPerformance(0.06, 0.03, 10)).toBe("winning");
  });

  it("aggregates theme performance without fabricating zeros", () => {
    const rows = aggregateThemePerformance([
      {
        id: "1",
        title: "A",
        contentPillar: "funding",
        channel: "LINKEDIN",
        reach: 1000,
        engagement: 50,
        clicks: null,
        engagementRate: 0.05,
        publishedAt: "2026-08-01",
      },
    ]);
    expect(rows[0]?.reach).toBe(1000);
    expect(rows[0]?.clicks).toBeNull();
  });
});

describe("next content recommendation", () => {
  it("returns null when no signals exist", () => {
    expect(buildNextContentRecommendation({ opportunities: [] })).toBeNull();
  });

  it("includes evidence strength metadata", () => {
    const rec = buildNextContentRecommendation({
      opportunities: [
        {
          id: "1",
          source: "calendar_gap",
          title: "Gap",
          finding: "No posts scheduled",
          evidence: [{ label: "Channel", value: "LinkedIn" }],
          whyItMatters: "Consistency",
          recommendedContent: "New post",
          recommendedChannels: ["LINKEDIN"],
          evidenceStrength: "moderate",
          action: { label: "Create brief", href: "/content/studio/create" },
        },
      ],
      scheduleGapChannel: "LinkedIn",
    });
    expect(rec?.evidenceStrength).toBe("moderate");
  });
});

describe("duplication detection", () => {
  it("detects similar recent content", () => {
    const warning = detectContentDuplication(
      {
        title: "SEIS eligibility explained clearly",
        hook: "Most founders miss documentation steps",
        body: "SEIS eligibility explained for startup founders",
        contentPillar: "funding",
      },
      [
        {
          id: "r1",
          title: "SEIS eligibility explained for founders",
          hook: "Most founders miss documentation",
          publishedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
          contentPillar: "funding",
          channel: "LINKEDIN",
        },
      ],
    );
    expect(warning).toContain("similar");
  });
});

describe("quality check", () => {
  it("flags missing CTA", () => {
    const result = evaluateContentQuality({
      master: { title: "T", body: "Body content here", keyPoints: [], status: "draft" },
    });
    expect(result.issues.some((i) => i.id === "cta-missing")).toBe(true);
  });
});

describe("unavailable metrics", () => {
  it("uses em dash not zero", () => {
    const rows = aggregateThemePerformance([]);
    expect(rows).toEqual([]);
    expect(unavailableValue()).toBe("—");
  });
});
