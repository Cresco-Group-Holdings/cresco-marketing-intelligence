import type { OnPageSeoFindingCategory, OnPageSeoRecommendationPriority } from "@prisma/client";
import { buildEvidence } from "@/lib/on-page/evidence";

export type PageAuditInput = {
  url: string;
  finalUrl?: string;
  statusCode?: number;
  title?: string | null;
  description?: string | null;
  canonicalUrl?: string | null;
  robotsDirective?: string | null;
  wordCount?: number | null;
  headings?: Array<{ level: number; text: string }> | null;
  images?: Array<{ src: string; alt?: string | null }>;
  internalLinks?: Array<{ url: string; anchor?: string; statusCode?: number }>;
  externalLinks?: Array<{ url: string; statusCode?: number }>;
  structuredData?: Array<{ type: string; valid: boolean; errors?: string[] }>;
  hasViewportMeta?: boolean;
  isHttps?: boolean;
  contentHash?: string | null;
  duplicateHashes?: string[];
  brokenLinks?: Array<{ url: string; statusCode: number }>;
  metadataDuplicates?: { title?: boolean; description?: boolean };
  emptySections?: string[];
  snapshotAge?: Date;
};

export type TechnicalFinding = {
  ruleId: string;
  category: OnPageSeoFindingCategory;
  title: string;
  description: string;
  priority: OnPageSeoRecommendationPriority;
  evidence: ReturnType<typeof buildEvidence>[];
};

function h1s(headings?: Array<{ level: number; text: string }> | null) {
  return (headings ?? []).filter((h) => h.level === 1);
}

export function runTechnicalChecks(input: PageAuditInput): TechnicalFinding[] {
  const findings: TechnicalFinding[] = [];
  const url = input.finalUrl ?? input.url;

  if (input.statusCode && input.statusCode >= 400) {
    findings.push({
      ruleId: input.statusCode >= 500 ? "HTTP_5XX" : "HTTP_4XX",
      category: "TECHNICAL",
      title: `HTTP ${input.statusCode} response`,
      description: `Page returns status code ${input.statusCode}.`,
      priority: input.statusCode >= 500 ? "BLOCKING" : "HIGH",
      evidence: [buildEvidence("crawl", "statusCode", input.statusCode)],
    });
  }

  const robots = (input.robotsDirective ?? "").toLowerCase();
  if (robots.includes("noindex")) {
    findings.push({
      ruleId: "NOINDEX",
      category: "TECHNICAL",
      title: "Page is noindex",
      description: "Robots directive includes noindex.",
      priority: "HIGH",
      evidence: [buildEvidence("crawl", "robotsDirective", input.robotsDirective)],
    });
  }

  if (input.canonicalUrl && input.canonicalUrl !== url) {
    findings.push({
      ruleId: "CANONICAL_MISMATCH",
      category: "TECHNICAL",
      title: "Canonical URL mismatch",
      description: `Canonical (${input.canonicalUrl}) differs from crawled URL (${url}).`,
      priority: "MEDIUM",
      evidence: [
        buildEvidence("crawl", "canonicalUrl", input.canonicalUrl),
        buildEvidence("crawl", "finalUrl", url),
      ],
    });
  }

  if (!input.title?.trim()) {
    findings.push({
      ruleId: "MISSING_TITLE",
      category: "TECHNICAL",
      title: "Missing title tag",
      description: "Page has no title element.",
      priority: "HIGH",
      evidence: [buildEvidence("crawl", "title", null)],
    });
  } else {
    if (input.title.length < 30) {
      findings.push({
        ruleId: "TITLE_TOO_SHORT",
        category: "TECHNICAL",
        title: "Title too short",
        description: `Title is ${input.title.length} characters (recommended 30–60).`,
        priority: "LOW",
        evidence: [buildEvidence("crawl", "titleLength", input.title.length)],
      });
    }
    if (input.title.length > 60) {
      findings.push({
        ruleId: "TITLE_TOO_LONG",
        category: "TECHNICAL",
        title: "Title too long",
        description: `Title is ${input.title.length} characters (recommended 30–60).`,
        priority: "LOW",
        evidence: [buildEvidence("crawl", "titleLength", input.title.length)],
      });
    }
  }

  if (!input.description?.trim()) {
    findings.push({
      ruleId: "MISSING_META_DESCRIPTION",
      category: "TECHNICAL",
      title: "Missing meta description",
      description: "Page has no meta description.",
      priority: "MEDIUM",
      evidence: [buildEvidence("crawl", "description", null)],
    });
  }

  const h1Count = h1s(input.headings).length;
  if (h1Count === 0) {
    findings.push({
      ruleId: "MISSING_H1",
      category: "TECHNICAL",
      title: "Missing H1",
      description: "Page has no H1 heading.",
      priority: "MEDIUM",
      evidence: [buildEvidence("crawl", "h1Count", 0)],
    });
  } else if (h1Count > 1) {
    findings.push({
      ruleId: "MULTIPLE_H1",
      category: "TECHNICAL",
      title: "Multiple H1 headings",
      description: `Page has ${h1Count} H1 headings.`,
      priority: "LOW",
      evidence: [buildEvidence("crawl", "h1Count", h1Count)],
    });
  }

  if ((input.wordCount ?? 0) < 100) {
    findings.push({
      ruleId: "EMPTY_PAGE",
      category: "TECHNICAL",
      title: "Empty or near-empty page",
      description: `Word count is ${input.wordCount ?? 0}.`,
      priority: "MEDIUM",
      evidence: [buildEvidence("crawl", "wordCount", input.wordCount ?? 0)],
    });
  } else if ((input.wordCount ?? 0) < 300) {
    findings.push({
      ruleId: "THIN_CONTENT",
      category: "TECHNICAL",
      title: "Thin content",
      description: `Word count is ${input.wordCount} (below 300).`,
      priority: "LOW",
      evidence: [buildEvidence("crawl", "wordCount", input.wordCount)],
    });
  }

  for (const img of input.images ?? []) {
    if (!img.alt?.trim()) {
      findings.push({
        ruleId: "MISSING_IMAGE_ALT",
        category: "ACCESSIBILITY",
        title: "Missing image alt text",
        description: `Image ${img.src} lacks alt attribute.`,
        priority: "LOW",
        evidence: [buildEvidence("crawl", "imageSrc", img.src)],
      });
    }
  }

  for (const link of input.internalLinks ?? []) {
    if (link.statusCode && link.statusCode >= 400) {
      findings.push({
        ruleId: "BROKEN_INTERNAL_LINK",
        category: "LINKS",
        title: "Broken internal link",
        description: `Link to ${link.url} returns ${link.statusCode}.`,
        priority: "HIGH",
        evidence: [
          buildEvidence("crawl", "linkUrl", link.url),
          buildEvidence("crawl", "linkStatusCode", link.statusCode),
        ],
      });
    }
  }

  for (const broken of input.brokenLinks ?? []) {
    findings.push({
      ruleId: "BROKEN_LINK",
      category: "LINKS",
      title: "Broken link",
      description: `Link ${broken.url} returns ${broken.statusCode}.`,
      priority: "HIGH",
      evidence: [
        buildEvidence("crawl", "brokenUrl", broken.url),
        buildEvidence("crawl", "statusCode", broken.statusCode),
      ],
    });
  }

  for (const sd of input.structuredData ?? []) {
    if (!sd.valid) {
      findings.push({
        ruleId: "INVALID_STRUCTURED_DATA",
        category: "STRUCTURED_DATA",
        title: "Invalid structured data",
        description: `${sd.type}: ${(sd.errors ?? []).join(", ") || "parse error"}`,
        priority: "LOW",
        evidence: [buildEvidence("crawl", "schemaType", sd.type), buildEvidence("crawl", "errors", sd.errors)],
      });
    }
  }

  if (input.isHttps === false) {
    findings.push({
      ruleId: "NON_HTTPS_URL",
      category: "TECHNICAL",
      title: "Non-HTTPS URL",
      description: "Page is not served over HTTPS.",
      priority: "HIGH",
      evidence: [buildEvidence("crawl", "url", url)],
    });
  }

  if (input.hasViewportMeta === false) {
    findings.push({
      ruleId: "MISSING_VIEWPORT",
      category: "TECHNICAL",
      title: "Missing viewport meta",
      description: "No mobile viewport meta tag detected.",
      priority: "MEDIUM",
      evidence: [buildEvidence("crawl", "hasViewportMeta", false)],
    });
  }

  if (input.duplicateHashes?.length) {
    findings.push({
      ruleId: "DUPLICATE_CONTENT_HASH",
      category: "TECHNICAL",
      title: "Duplicate content signal",
      description: `${input.duplicateHashes.length} other page(s) share the same content hash.`,
      priority: "MEDIUM",
      evidence: [buildEvidence("crawl", "contentHash", input.contentHash), buildEvidence("crawl", "duplicates", input.duplicateHashes)],
    });
  }

  if (input.metadataDuplicates?.title) {
    findings.push({
      ruleId: "DUPLICATE_TITLE",
      category: "TECHNICAL",
      title: "Duplicate title",
      description: "Title is duplicated across multiple pages.",
      priority: "MEDIUM",
      evidence: [buildEvidence("crawl", "title", input.title)],
    });
  }

  if (input.metadataDuplicates?.description) {
    findings.push({
      ruleId: "DUPLICATE_DESCRIPTION",
      category: "TECHNICAL",
      title: "Duplicate meta description",
      description: "Meta description is duplicated across multiple pages.",
      priority: "LOW",
      evidence: [buildEvidence("crawl", "description", input.description)],
    });
  }

  for (const section of input.emptySections ?? []) {
    findings.push({
      ruleId: "EMPTY_SECTION",
      category: "TECHNICAL",
      title: "Empty section",
      description: `Section "${section}" has no content.`,
      priority: "LOW",
      evidence: [buildEvidence("draft", "emptySection", section)],
    });
  }

  return findings;
}

export function isSnapshotStale(snapshotAge?: Date, maxDays = 14): boolean {
  if (!snapshotAge) return false;
  const ageMs = Date.now() - snapshotAge.getTime();
  return ageMs > maxDays * 24 * 60 * 60 * 1000;
}
