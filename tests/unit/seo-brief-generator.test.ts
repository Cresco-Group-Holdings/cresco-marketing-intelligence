import { describe, expect, it } from "vitest";
import { seoBriefOutputSchema } from "@/lib/ai/brief-output-schemas";
import {
  competitorEvidenceDisclaimer,
  sanitiseCompetitorHeading,
  truncateCompetitorExcerpt,
  validateBriefDoesNotInstructPlagiarism,
} from "@/lib/briefs/competitor-guardrails";
import { assembleEvidenceLimitations } from "@/lib/briefs/evidence-assembler";
import { recommendInternalLinks } from "@/lib/briefs/internal-links";
import { filterAllowedSchemaTypes, suggestSchemaTypes } from "@/lib/briefs/schema-suggestions";
import { BRIEF_STATUS_TRANSITIONS } from "@/lib/briefs/constants";

const validBrief = {
  workingTitle: "Guide to Email Marketing",
  contentType: "GUIDE",
  audience: "Small business marketers",
  userProblem: "Low email open rates",
  primaryIntent: "INFORMATIONAL",
  primaryKeyword: "email marketing tips",
  secondaryKeywords: ["email automation"],
  entities: [{ type: "SERVICE", value: "email marketing" }],
  recommendedAngle: "Practical, brand-specific tactics",
  differentiators: ["First-party data focus"],
  outline: ["Introduction", "Strategy", "Tactics", "Conclusion"],
  headings: [{ level: 1, text: "Email Marketing Tips" }, { level: 2, text: "Strategy" }],
  questionsToAnswer: ["What is email marketing?"],
  faq: [{ question: "How often to send?", answerGuidance: "Cover frequency best practices" }],
  internalLinkConcepts: [],
  externalEvidenceNeeds: ["Industry benchmark source"],
  schemaSuggestions: [{ schemaType: "Article", rationale: "Editorial guide" }],
  cta: "Start free trial",
  tone: "Professional, helpful",
  targetLengthMin: 1200,
  targetLengthMax: 2000,
  eeatChecklist: ["Author expertise noted", "Sources cited"],
  complianceWarnings: [],
  successMetrics: ["Organic traffic", "Time on page"],
  limitations: "No current SERP data",
  originalityGuidance: "Create original content; do not copy competitors",
};

describe("brief output schema validation", () => {
  it("accepts valid structured brief output", () => {
    expect(seoBriefOutputSchema.parse(validBrief)).toBeDefined();
  });

  it("rejects missing required fields", () => {
    expect(() => seoBriefOutputSchema.parse({ workingTitle: "x" })).toThrow();
  });
});

describe("competitor copyright guardrails", () => {
  it("truncates competitor excerpts", () => {
    const long = "x".repeat(300);
    expect(truncateCompetitorExcerpt(long).length).toBeLessThanOrEqual(201);
  });

  it("sanitises heading length", () => {
    expect(sanitiseCompetitorHeading("a".repeat(200)).length).toBe(120);
  });

  it("flags plagiarism instructions", () => {
    const warnings = validateBriefDoesNotInstructPlagiarism({
      recommendedAngle: "Copy the competitor outline exactly",
      originalityGuidance: "be creative",
    });
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("includes competitor disclaimer", () => {
    expect(competitorEvidenceDisclaimer()).toContain("Do not reproduce");
  });
});

describe("internal link recommendations", () => {
  it("suggests links based on topic overlap", () => {
    const links = recommendInternalLinks({
      targetPage: { id: "p1", url: "/email-marketing" },
      relatedPages: [
        { id: "p2", url: "/automation", topics: ["email marketing", "automation"] },
        { id: "p3", url: "/unrelated", topics: ["cooking"] },
      ],
      clusterTopics: ["email marketing"],
      primaryKeyword: "email marketing",
    });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].destinationPageId).toBe("p2");
    expect(links[0].confidence).toBeGreaterThan(0);
  });
});

describe("schema restrictions", () => {
  it("only allows approved schema types", () => {
    expect(filterAllowedSchemaTypes(["Article", "InvalidType"])).toEqual(["Article"]);
  });

  it("suggests FAQ schema when FAQ present", () => {
    const suggestions = suggestSchemaTypes({ hasFaq: true });
    expect(suggestions.some((s) => s.schemaType === "FAQPage")).toBe(true);
    expect(suggestions.every((s) => s.eligibilityNote.length > 0)).toBe(true);
  });
});

describe("missing evidence handling", () => {
  it("documents limitations when SERP data absent", () => {
    const limitations = assembleEvidenceLimitations({
      keywords: [],
      competitorEvidence: [],
      serpEvidence: [{ query: "test", hasCurrentData: false, note: "none" }],
      searchConsole: { hasData: false, note: "none" },
      brandKnowledge: { hasSnapshot: false },
      limitations: [],
    });
    expect(limitations.some((l) => l.includes("SERP"))).toBe(true);
    expect(limitations.some((l) => l.includes("Search Console"))).toBe(true);
  });
});

describe("approval workflow statuses", () => {
  it("defines valid status transitions", () => {
    expect(BRIEF_STATUS_TRANSITIONS.GENERATED).toContain("IN_REVIEW");
    expect(BRIEF_STATUS_TRANSITIONS.IN_REVIEW).toContain("APPROVED");
    expect(BRIEF_STATUS_TRANSITIONS.APPROVED).toContain("SUPERSEDED");
  });
});
