import { describe, expect, it } from "vitest";
import { onPageSemanticReviewSchema } from "@/lib/ai/on-page-output-schemas";
import { buildEvidence, validateFindingHasEvidence } from "@/lib/on-page/evidence";
import { runKeywordReview } from "@/lib/on-page/keyword-review";
import { buildReadabilityReport } from "@/lib/on-page/readability";
import { isSnapshotStale, runTechnicalChecks } from "@/lib/on-page/technical-checks";
import { RANKING_DISCLAIMER } from "@/lib/on-page/constants";

describe("technical checks", () => {
  it("detects missing title and H1", () => {
    const findings = runTechnicalChecks({
      url: "https://example.com/page",
      statusCode: 200,
      title: "",
      headings: [],
      wordCount: 50,
    });
    expect(findings.some((f) => f.ruleId === "MISSING_TITLE")).toBe(true);
    expect(findings.some((f) => f.ruleId === "MISSING_H1")).toBe(true);
  });

  it("detects HTTP errors", () => {
    const findings = runTechnicalChecks({ url: "https://example.com/404", statusCode: 404 });
    expect(findings.some((f) => f.ruleId === "HTTP_4XX")).toBe(true);
  });

  it("flags non-HTTPS", () => {
    const findings = runTechnicalChecks({ url: "http://example.com", isHttps: false });
    expect(findings.some((f) => f.ruleId === "NON_HTTPS_URL")).toBe(true);
  });

  it("requires evidence on every finding", () => {
    const findings = runTechnicalChecks({
      url: "https://example.com",
      statusCode: 200,
      title: "Short",
    });
    for (const f of findings) {
      expect(f.evidence.length).toBeGreaterThan(0);
    }
  });
});

describe("keyword review", () => {
  it("does not flag natural keyword use", () => {
    const body = [
      "Email marketing helps businesses reach customers with relevant, permission-based messages.",
      "Start with a welcome series, segment your list by behaviour, and measure open rates over time.",
      "Consistent value builds trust and improves engagement across campaigns without overwhelming subscribers.",
      "Test subject lines, personalise content, and review deliverability metrics monthly for continuous improvement.",
      "A thoughtful strategy balances promotional content with educational resources your audience expects.",
    ].join(" ");
    const findings = runKeywordReview({
      targetKeyword: "email marketing",
      title: "Email marketing guide",
      headings: [{ level: 1, text: "Email marketing basics" }],
      bodyText: body,
    });
    expect(findings.some((f) => f.ruleId === "KEYWORD_STUFFING")).toBe(false);
  });

  it("flags keyword stuffing", () => {
    const stuffed = Array(50).fill("email marketing").join(" ");
    const findings = runKeywordReview({
      targetKeyword: "email marketing",
      bodyText: stuffed,
    });
    expect(findings.some((f) => f.ruleId === "KEYWORD_STUFFING")).toBe(true);
  });

  it("flags absent target keyword", () => {
    const findings = runKeywordReview({
      targetKeyword: "seo audit",
      bodyText: "This page is about cooking recipes.",
    });
    expect(findings.some((f) => f.ruleId === "KEYWORD_ABSENT")).toBe(true);
  });
});

describe("readability indicators", () => {
  it("provides transparent indicators without absolute score", () => {
    const report = buildReadabilityReport({
      bodyText: "This is a sentence. ".repeat(20),
      headings: [{ level: 2, text: "Section" }],
    });
    expect(report.note).toContain("advisory");
    expect(report.indicators.length).toBeGreaterThan(0);
  });
});

describe("evidence linking", () => {
  it("validates findings have evidence", () => {
    const refs = [buildEvidence("crawl", "title", "Test")];
    expect(validateFindingHasEvidence(refs)).toBe(true);
    expect(validateFindingHasEvidence([])).toBe(false);
  });
});

describe("semantic review schema", () => {
  it("requires evidence on AI findings", () => {
    const valid = {
      findings: [{
        category: "SEMANTIC",
        title: "Intent mismatch",
        description: "Content does not match informational intent.",
        priority: "MEDIUM",
        evidence: [{ source: "brief", key: "intent", value: "INFORMATIONAL" }],
      }],
      intentAlignment: { score: 0.6, note: "Partial", evidence: [{ source: "brief", key: "intent", value: "INFO" }] },
      topicCompleteness: { covered: ["a"], missing: ["b"], evidence: [{ source: "brief", key: "topics", value: [] }] },
      limitations: ["No SERP data"],
      disclaimer: RANKING_DISCLAIMER,
    };
    expect(onPageSemanticReviewSchema.parse(valid)).toBeDefined();
  });
});

describe("stale snapshot warning", () => {
  it("detects stale snapshots", () => {
    const old = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    expect(isSnapshotStale(old, 14)).toBe(true);
    expect(isSnapshotStale(new Date(), 14)).toBe(false);
  });
});

describe("draft versus live page", () => {
  it("audits draft content without URL", () => {
    const findings = runTechnicalChecks({
      url: "draft://long-form",
      title: "Draft title for SEO guide",
      description: "A comprehensive guide",
      headings: [{ level: 1, text: "SEO Guide" }],
      wordCount: 500,
      emptySections: ["Conclusion"],
    });
    expect(findings.some((f) => f.ruleId === "EMPTY_SECTION")).toBe(true);
  });
});

describe("ranking disclaimer", () => {
  it("includes no-guarantee language", () => {
    expect(RANKING_DISCLAIMER.toLowerCase()).toContain("not guaranteed");
  });
});

describe("tenant isolation concept", () => {
  it("evidence refs are source-scoped", () => {
    const ref = buildEvidence("crawl", "pageId", "abc123");
    expect(ref.source).toBe("crawl");
  });
});
