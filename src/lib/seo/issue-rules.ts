import type { SeoIssueSeverity } from "@prisma/client";
import { SEO_ISSUE_RULE_VERSION } from "@/lib/seo/constants";
import type { HtmlExtraction } from "@/lib/seo/html-extractor";

export type IssueRuleDefinition = {
  ruleId: string;
  version: number;
  name: string;
  description: string;
  severity: SeoIssueSeverity;
  category: string;
  thresholds?: Record<string, number | string | boolean>;
};

export type DetectedIssue = {
  ruleId: string;
  ruleVersion: number;
  severity: SeoIssueSeverity;
  affectedUrl: string;
  evidence: Record<string, unknown>;
  explanation: string;
  recommendedAction: string;
};

export const SEO_ISSUE_DEFINITIONS: IssueRuleDefinition[] = [
  {
    ruleId: "HTTP_4XX",
    version: SEO_ISSUE_RULE_VERSION,
    name: "4xx page",
    description: "Page returns a client error status code.",
    severity: "HIGH",
    category: "http",
  },
  {
    ruleId: "HTTP_5XX",
    version: SEO_ISSUE_RULE_VERSION,
    name: "5xx page",
    description: "Page returns a server error status code.",
    severity: "CRITICAL",
    category: "http",
  },
  {
    ruleId: "REDIRECT_CHAIN",
    version: SEO_ISSUE_RULE_VERSION,
    name: "Redirect chain",
    description: "URL passes through multiple redirects.",
    severity: "MEDIUM",
    category: "redirects",
    thresholds: { maxHops: 2 },
  },
  {
    ruleId: "REDIRECT_LOOP",
    version: SEO_ISSUE_RULE_VERSION,
    name: "Redirect loop",
    description: "Redirect chain loops back to a prior URL.",
    severity: "HIGH",
    category: "redirects",
  },
  {
    ruleId: "MISSING_TITLE",
    version: SEO_ISSUE_RULE_VERSION,
    name: "Missing title",
    description: "Page has no title element.",
    severity: "HIGH",
    category: "on-page",
  },
  {
    ruleId: "TITLE_TOO_SHORT",
    version: SEO_ISSUE_RULE_VERSION,
    name: "Title too short",
    description: "Title is shorter than recommended.",
    severity: "LOW",
    category: "on-page",
    thresholds: { minLength: 30 },
  },
  {
    ruleId: "TITLE_TOO_LONG",
    version: SEO_ISSUE_RULE_VERSION,
    name: "Title too long",
    description: "Title exceeds recommended length.",
    severity: "LOW",
    category: "on-page",
    thresholds: { maxLength: 60 },
  },
  {
    ruleId: "MISSING_META_DESCRIPTION",
    version: SEO_ISSUE_RULE_VERSION,
    name: "Missing meta description",
    description: "Page has no meta description.",
    severity: "MEDIUM",
    category: "on-page",
  },
  {
    ruleId: "MISSING_H1",
    version: SEO_ISSUE_RULE_VERSION,
    name: "Missing H1",
    description: "Page has no H1 heading.",
    severity: "MEDIUM",
    category: "on-page",
  },
  {
    ruleId: "MULTIPLE_H1",
    version: SEO_ISSUE_RULE_VERSION,
    name: "Multiple H1",
    description: "Page has more than one H1 heading.",
    severity: "LOW",
    category: "on-page",
    thresholds: { maxCount: 1 },
  },
  {
    ruleId: "EMPTY_PAGE",
    version: SEO_ISSUE_RULE_VERSION,
    name: "Empty page",
    description: "Page has negligible text content.",
    severity: "MEDIUM",
    category: "content",
    thresholds: { minTextLength: 100 },
  },
  {
    ruleId: "THIN_CONTENT",
    version: SEO_ISSUE_RULE_VERSION,
    name: "Thin content",
    description: "Page has very little text content.",
    severity: "LOW",
    category: "content",
    thresholds: { minWordCount: 300 },
  },
  {
    ruleId: "NON_HTTPS_URL",
    version: SEO_ISSUE_RULE_VERSION,
    name: "Non-HTTPS URL",
    description: "Page is served over HTTP.",
    severity: "HIGH",
    category: "security",
  },
  {
    ruleId: "SLOW_RESPONSE",
    version: SEO_ISSUE_RULE_VERSION,
    name: "Slow response",
    description: "Page response time exceeds threshold.",
    severity: "MEDIUM",
    category: "performance",
    thresholds: { maxResponseMs: 3000 },
  },
  {
    ruleId: "OVERSIZED_PAGE",
    version: SEO_ISSUE_RULE_VERSION,
    name: "Oversized page",
    description: "HTML payload exceeds size threshold.",
    severity: "LOW",
    category: "performance",
    thresholds: { maxBytes: 1_048_576 },
  },
  {
    ruleId: "MISSING_IMAGE_ALT",
    version: SEO_ISSUE_RULE_VERSION,
    name: "Missing image alt",
    description: "Image lacks alt text.",
    severity: "LOW",
    category: "accessibility",
  },
  {
    ruleId: "NOINDEX_IN_SITEMAP",
    version: SEO_ISSUE_RULE_VERSION,
    name: "Noindex page in sitemap",
    description: "Page is noindex but listed in sitemap.",
    severity: "HIGH",
    category: "indexing",
  },
  {
    ruleId: "CANONICAL_MISMATCH",
    version: SEO_ISSUE_RULE_VERSION,
    name: "Canonical mismatch",
    description: "Canonical URL differs from crawled URL.",
    severity: "MEDIUM",
    category: "canonical",
  },
  {
    ruleId: "CONFLICTING_ROBOTS",
    version: SEO_ISSUE_RULE_VERSION,
    name: "Conflicting robots directives",
    description: "Meta robots conflicts with X-Robots-Tag.",
    severity: "MEDIUM",
    category: "indexing",
  },
  {
    ruleId: "INVALID_STRUCTURED_DATA",
    version: SEO_ISSUE_RULE_VERSION,
    name: "Invalid structured data",
    description: "JSON-LD failed to parse.",
    severity: "LOW",
    category: "structured-data",
  },
  {
    ruleId: "BROKEN_INTERNAL_LINK",
    version: SEO_ISSUE_RULE_VERSION,
    name: "Broken internal link",
    description: "Internal link targets a 4xx/5xx page.",
    severity: "HIGH",
    category: "links",
  },
  {
    ruleId: "DUPLICATE_CONTENT_HASH",
    version: SEO_ISSUE_RULE_VERSION,
    name: "Duplicate content",
    description: "Multiple pages share identical content hash.",
    severity: "MEDIUM",
    category: "content",
  },
];

export type PageContext = {
  url: string;
  finalUrl: string;
  statusCode: number;
  responseTimeMs?: number;
  contentLength?: number;
  redirectChain?: string[];
  extraction?: HtmlExtraction;
  robotsHeader?: string;
  inSitemap?: boolean;
  contentHash?: string;
};

export function evaluatePageRules(ctx: PageContext): DetectedIssue[] {
  const issues: DetectedIssue[] = [];
  const ext = ctx.extraction;

  if (ctx.statusCode >= 400 && ctx.statusCode < 500) {
    issues.push(makeIssue("HTTP_4XX", ctx.url, { statusCode: ctx.statusCode }, "HIGH"));
  }
  if (ctx.statusCode >= 500) {
    issues.push(makeIssue("HTTP_5XX", ctx.url, { statusCode: ctx.statusCode }, "CRITICAL"));
  }

  const chain = ctx.redirectChain ?? [];
  const maxHops = (SEO_ISSUE_DEFINITIONS.find((d) => d.ruleId === "REDIRECT_CHAIN")?.thresholds
    ?.maxHops ?? 2) as number;
  if (chain.length > maxHops) {
    issues.push(
      makeIssue("REDIRECT_CHAIN", ctx.url, { chain, hops: chain.length }, "MEDIUM"),
    );
  }
  const unique = new Set(chain);
  if (unique.size < chain.length) {
    issues.push(makeIssue("REDIRECT_LOOP", ctx.url, { chain }, "HIGH"));
  }

  if (ctx.finalUrl.startsWith("http://")) {
    issues.push(makeIssue("NON_HTTPS_URL", ctx.finalUrl, {}, "HIGH"));
  }

  const slowThreshold = 3000;
  if (ctx.responseTimeMs && ctx.responseTimeMs > slowThreshold) {
    issues.push(
      makeIssue("SLOW_RESPONSE", ctx.url, { responseTimeMs: ctx.responseTimeMs }, "MEDIUM"),
    );
  }

  if (ctx.contentLength && ctx.contentLength > 1_048_576) {
    issues.push(makeIssue("OVERSIZED_PAGE", ctx.url, { contentLength: ctx.contentLength }, "LOW"));
  }

  if (!ext || ctx.statusCode >= 400) return issues;

  if (!ext.title) {
    issues.push(makeIssue("MISSING_TITLE", ctx.url, {}, "HIGH"));
  } else {
    if (ext.title.length < 30) {
      issues.push(makeIssue("TITLE_TOO_SHORT", ctx.url, { title: ext.title, length: ext.title.length }, "LOW"));
    }
    if (ext.title.length > 60) {
      issues.push(makeIssue("TITLE_TOO_LONG", ctx.url, { title: ext.title, length: ext.title.length }, "LOW"));
    }
  }

  if (!ext.description) {
    issues.push(makeIssue("MISSING_META_DESCRIPTION", ctx.url, {}, "MEDIUM"));
  }

  const h1s = ext.headings.filter((h) => h.level === 1);
  if (h1s.length === 0) {
    issues.push(makeIssue("MISSING_H1", ctx.url, {}, "MEDIUM"));
  } else if (h1s.length > 1) {
    issues.push(makeIssue("MULTIPLE_H1", ctx.url, { count: h1s.length, headings: h1s.map((h) => h.text) }, "LOW"));
  }

  if (ext.textLength < 100) {
    issues.push(makeIssue("EMPTY_PAGE", ctx.url, { textLength: ext.textLength }, "MEDIUM"));
  } else {
    const words = ext.textLength / 5;
    if (words < 300) {
      issues.push(makeIssue("THIN_CONTENT", ctx.url, { approxWords: Math.round(words) }, "LOW"));
    }
  }

  for (const img of ext.images) {
    if (!img.alt?.trim()) {
      issues.push(makeIssue("MISSING_IMAGE_ALT", ctx.url, { src: img.src }, "LOW"));
    }
  }

  if (ext.metaRobots?.toLowerCase().includes("noindex") && ctx.inSitemap) {
    issues.push(makeIssue("NOINDEX_IN_SITEMAP", ctx.url, { metaRobots: ext.metaRobots }, "HIGH"));
  }

  if (ext.canonical && ext.canonical !== ctx.finalUrl && ext.canonical !== ctx.url) {
    issues.push(
      makeIssue("CANONICAL_MISMATCH", ctx.url, { canonical: ext.canonical, crawled: ctx.finalUrl }, "MEDIUM"),
    );
  }

  if (ext.metaRobots && ctx.robotsHeader && ext.metaRobots !== ctx.robotsHeader) {
    issues.push(
      makeIssue("CONFLICTING_ROBOTS", ctx.url, { meta: ext.metaRobots, header: ctx.robotsHeader }, "MEDIUM"),
    );
  }

  for (const sd of ext.structuredData) {
    if (sd.schemaType === "Invalid") {
      issues.push(makeIssue("INVALID_STRUCTURED_DATA", ctx.url, { raw: sd.raw.slice(0, 200) }, "LOW"));
    }
  }

  return issues;
}

function makeIssue(
  ruleId: string,
  url: string,
  evidence: Record<string, unknown>,
  severity: SeoIssueSeverity,
): DetectedIssue {
  const def = SEO_ISSUE_DEFINITIONS.find((d) => d.ruleId === ruleId);
  return {
    ruleId,
    ruleVersion: def?.version ?? SEO_ISSUE_RULE_VERSION,
    severity,
    affectedUrl: url,
    evidence,
    explanation: def?.description ?? ruleId,
    recommendedAction: `Review and fix: ${def?.name ?? ruleId}`,
  };
}

export function evaluateBrokenInternalLink(
  sourceUrl: string,
  destinationUrl: string,
  statusCode: number,
): DetectedIssue | null {
  if (statusCode < 400) return null;
  return {
    ruleId: "BROKEN_INTERNAL_LINK",
    ruleVersion: SEO_ISSUE_RULE_VERSION,
    severity: "HIGH",
    affectedUrl: sourceUrl,
    evidence: { destinationUrl, statusCode },
    explanation: `Internal link to ${destinationUrl} returns ${statusCode}.`,
    recommendedAction: "Fix or remove the broken internal link.",
  };
}

export function findDuplicateContentHashes(
  pages: Array<{ url: string; contentHash: string }>,
): DetectedIssue[] {
  const byHash = new Map<string, string[]>();
  for (const page of pages) {
    if (!page.contentHash) continue;
    const list = byHash.get(page.contentHash) ?? [];
    list.push(page.url);
    byHash.set(page.contentHash, list);
  }
  const issues: DetectedIssue[] = [];
  for (const [hash, urls] of byHash) {
    if (urls.length < 2) continue;
    for (const url of urls) {
      issues.push({
        ruleId: "DUPLICATE_CONTENT_HASH",
        ruleVersion: SEO_ISSUE_RULE_VERSION,
        severity: "MEDIUM",
        affectedUrl: url,
        evidence: { contentHash: hash, duplicateUrls: urls.filter((u) => u !== url) },
        explanation: "Page content is identical to other URLs.",
        recommendedAction: "Consolidate duplicate pages with canonical tags or redirects.",
      });
    }
  }
  return issues;
}

export function validateHreflang(
  entries: Array<{ lang: string; href: string }>,
): DetectedIssue[] {
  const issues: DetectedIssue[] = [];
  const langs = new Set<string>();
  for (const entry of entries) {
    if (!entry.lang || !/^[a-z]{2}(-[A-Z]{2})?$/i.test(entry.lang)) {
      issues.push({
        ruleId: "INVALID_HREFLANG",
        ruleVersion: SEO_ISSUE_RULE_VERSION,
        severity: "MEDIUM",
        affectedUrl: entry.href,
        evidence: { lang: entry.lang },
        explanation: "Hreflang value is not a valid language code.",
        recommendedAction: "Use ISO 639-1 language codes with optional region.",
      });
    }
    if (langs.has(entry.lang)) {
      issues.push({
        ruleId: "INVALID_HREFLANG",
        ruleVersion: SEO_ISSUE_RULE_VERSION,
        severity: "MEDIUM",
        affectedUrl: entry.href,
        evidence: { lang: entry.lang, reason: "duplicate" },
        explanation: "Duplicate hreflang declaration.",
        recommendedAction: "Each language should appear only once per page.",
      });
    }
    langs.add(entry.lang);
  }
  return issues;
}
