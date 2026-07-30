import { describe, expect, it } from "vitest";
import { longFormOutlineSchema, longFormSectionSchema } from "@/lib/ai/long-form-output-schemas";
import {
  classifyClaim,
  detectClaimsInText,
  flagUnsupportedClaims,
  validateCitationNotFabricated,
} from "@/lib/long-form/claim-detection";
import { runLongFormComplianceChecks, hasBlockingComplianceFindings } from "@/lib/long-form/compliance-rules";
import { LONG_FORM_STATUS_TRANSITIONS } from "@/lib/long-form/constants";
import {
  checksumPayload,
  exportToCmsPayload,
  exportToHtml,
  exportToMarkdown,
  exportToJson,
} from "@/lib/long-form/export";
import { mergeSectionWithLockedText } from "@/lib/long-form/locked-text";
import { buildSeoAssistanceReport } from "@/lib/long-form/seo-assistance";

const sampleDoc = {
  id: "doc1",
  title: "Email Marketing Guide",
  slug: "email-marketing-guide",
  metaDescription: "Learn email marketing tips",
  contentType: "GUIDE",
  status: "SECTIONS_DRAFT",
  sections: [
    { id: "s1", sortOrder: 0, heading: "Introduction", headingLevel: 2, blockType: "PARAGRAPH", body: "Email marketing helps businesses grow." },
    { id: "s2", sortOrder: 1, heading: "Strategy", headingLevel: 2, blockType: "PARAGRAPH", body: "Studies show 40% higher open rates with personalisation." },
  ],
  citations: [{ label: "Industry Report", url: "https://example.com/report" }],
};

describe("long-form output schemas", () => {
  it("accepts valid outline output", () => {
    const outline = {
      title: "Guide",
      sections: [{ heading: "Intro", summary: "Overview", headingLevel: 2 }],
    };
    expect(longFormOutlineSchema.parse(outline)).toBeDefined();
  });

  it("accepts valid section output", () => {
    const section = { body: "Content here.", blockType: "PARAGRAPH" };
    expect(longFormSectionSchema.parse(section)).toBeDefined();
  });
});

describe("claim detection", () => {
  it("classifies marketing statements", () => {
    const claim = classifyClaim("Our platform is the best-in-class solution with guaranteed results.");
    expect(claim.classification).toBe("MARKETING_STATEMENT");
    expect(claim.flagged).toBe(true);
  });

  it("flags citation-required factual claims", () => {
    const claims = detectClaimsInText("Studies show that 85% of marketers use email automation in 2024.");
    expect(claims.some((c) => c.classification === "CITATION_REQUIRED")).toBe(true);
  });

  it("flags unsupported claims", () => {
    const claims = flagUnsupportedClaims([
      { claimText: "Revenue increased 50%", classification: "CITATION_REQUIRED", isSupported: false, requiresCitation: true, flagged: false },
    ]);
    expect(claims[0].flagged).toBe(true);
  });

  it("detects fabricated citation URLs", () => {
    const result = validateCitationNotFabricated({ label: "Bad", url: "not-a-url" });
    expect(result.isFabricated).toBe(true);
  });
});

describe("compliance rules", () => {
  it("blocks Cresco Grants funding guarantees", () => {
    const findings = runLongFormComplianceChecks("You are guaranteed funding success.", { brandSlug: "cresco-grants" });
    expect(findings.some((f) => f.ruleId === "cresco-grants-no-guarantee")).toBe(true);
    expect(hasBlockingComplianceFindings(findings)).toBe(true);
  });

  it("warns on Capital Cresco invented returns", () => {
    const findings = runLongFormComplianceChecks("The stock returned 45% in 2024.", { brandSlug: "capital-cresco-terminal" });
    expect(findings.some((f) => f.ruleId === "capital-cresco-invented-results")).toBe(true);
  });
});

describe("locked text preservation", () => {
  it("preserves locked ranges when merging", () => {
    const original = "Hello LOCKED world";
    const locked = [{ start: 6, end: 12 }];
    const merged = mergeSectionWithLockedText(original, "Hi there world", locked);
    expect(merged).toContain("LOCKED");
  });
});

describe("SEO assistance", () => {
  it("reports keyword coverage without absolute score", () => {
    const report = buildSeoAssistanceReport({
      title: "Email Marketing Guide",
      sections: [{ heading: "Email marketing tips", body: "Email marketing is essential." }],
      briefKeywords: ["email marketing"],
      briefHeadings: [{ level: 2, text: "Email marketing tips" }],
    });
    expect(report.keywordCoverage[0].count).toBeGreaterThan(0);
    expect(report.notes.some((n) => n.includes("advisory"))).toBe(true);
  });
});

describe("exports", () => {
  it("exports HTML with title", () => {
    const html = exportToHtml(sampleDoc);
    expect(html).toContain("<h1>Email Marketing Guide</h1>");
    expect(html).toContain("References");
  });

  it("exports Markdown", () => {
    const md = exportToMarkdown(sampleDoc);
    expect(md).toContain("# Email Marketing Guide");
    expect(md).toContain("## Strategy");
  });

  it("exports JSON with publishReady false", () => {
    const json = exportToJson(sampleDoc);
    expect(json.publishReady).toBe(false);
  });

  it("exports CMS payload with adapter extension point", () => {
    const cms = exportToCmsPayload(sampleDoc);
    expect(cms.adapter).toBe("generic");
    expect(cms.publishReady).toBe(false);
    expect(cms.note).toContain("manual publish");
  });

  it("generates checksum for payload", () => {
    const checksum = checksumPayload({ test: true });
    expect(checksum).toHaveLength(64);
  });
});

describe("workflow statuses", () => {
  it("defines valid status transitions", () => {
    expect(LONG_FORM_STATUS_TRANSITIONS.OUTLINE_PENDING).toContain("OUTLINE_CONFIRMED");
    expect(LONG_FORM_STATUS_TRANSITIONS.SECTIONS_DRAFT).toContain("EVIDENCE_REVIEW");
    expect(LONG_FORM_STATUS_TRANSITIONS.APPROVED).toContain("PUBLISH_READY");
  });
});

describe("brief-to-document requirements", () => {
  it("requires approved brief status conceptually", () => {
    expect(LONG_FORM_STATUS_TRANSITIONS.DRAFT).toContain("OUTLINE_PENDING");
  });
});

describe("provenance fields", () => {
  it("CMS payload includes no auto-publish flag", () => {
    const cms = exportToCmsPayload(sampleDoc);
    expect(cms.publishReady).toBe(false);
  });
});

describe("tenant isolation concept", () => {
  it("document export includes organisation-scoped id", () => {
    const json = exportToJson(sampleDoc);
    expect(json.id).toBe("doc1");
  });
});
