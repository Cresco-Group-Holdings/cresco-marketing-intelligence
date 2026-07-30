import { buildEvidence } from "@/lib/on-page/evidence";

export type KeywordReviewInput = {
  targetKeyword?: string;
  secondaryKeywords?: string[];
  title?: string | null;
  description?: string | null;
  headings?: Array<{ level: number; text: string }>;
  bodyText?: string;
  conflictingPages?: Array<{ url: string; keyword: string }>;
};

export type KeywordFinding = {
  ruleId: string;
  title: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  evidence: ReturnType<typeof buildEvidence>[];
};

const STUFFING_THRESHOLD = 0.03;
const MAX_KEYWORD_DENSITY_NOTE = 0.025;

function countOccurrences(text: string, term: string): number {
  const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return (text.match(regex) ?? []).length;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function runKeywordReview(input: KeywordReviewInput): KeywordFinding[] {
  const findings: KeywordFinding[] = [];
  if (!input.targetKeyword) return findings;

  const targetKeyword = input.targetKeyword;
  const fullText = [
    input.title ?? "",
    input.description ?? "",
    ...(input.headings ?? []).map((h) => h.text),
    input.bodyText ?? "",
  ].join(" ");

  const bodyOnly = input.bodyText ?? "";
  const words = wordCount(bodyOnly || fullText);
  const occurrences = countOccurrences(fullText, targetKeyword);
  const bodyOccurrences = countOccurrences(bodyOnly, targetKeyword);
  const density = words > 0 ? bodyOccurrences / words : 0;

  const inTitle = (input.title ?? "").toLowerCase().includes(targetKeyword.toLowerCase());
  const inDescription = (input.description ?? "").toLowerCase().includes(targetKeyword.toLowerCase());
  const inH1 = (input.headings ?? []).some((h) => h.level === 1 && h.text.toLowerCase().includes(targetKeyword.toLowerCase()));

  if (!inTitle && !inH1) {
    findings.push({
      ruleId: "KEYWORD_NOT_IN_HEADINGS",
      title: "Target keyword absent from title/H1",
      description: `Target keyword "${targetKeyword}" not found in title or H1.`,
      priority: "MEDIUM",
      evidence: [
        buildEvidence("keyword", "targetKeyword", targetKeyword),
        buildEvidence("crawl", "title", input.title),
        buildEvidence("crawl", "h1", (input.headings ?? []).filter((h) => h.level === 1)),
      ],
    });
  }

  if (occurrences === 0) {
    findings.push({
      ruleId: "KEYWORD_ABSENT",
      title: "Target keyword not present",
      description: `Target keyword "${targetKeyword}" not found in page content.`,
      priority: "HIGH",
      evidence: [buildEvidence("keyword", "targetKeyword", targetKeyword), buildEvidence("crawl", "occurrences", 0)],
    });
  }

  if (density > STUFFING_THRESHOLD) {
    findings.push({
      ruleId: "KEYWORD_STUFFING",
      title: "Possible keyword over-optimisation",
      description: `Keyword density ${(density * 100).toFixed(1)}% exceeds natural use threshold. Do not add more keyword mentions.`,
      priority: "HIGH",
      evidence: [
        buildEvidence("keyword", "density", density),
        buildEvidence("keyword", "occurrences", occurrences),
        buildEvidence("keyword", "wordCount", words),
      ],
    });
  } else if (density > MAX_KEYWORD_DENSITY_NOTE && density <= STUFFING_THRESHOLD) {
    findings.push({
      ruleId: "KEYWORD_DENSITY_HIGH",
      title: "Keyword density elevated",
      description: `Density ${(density * 100).toFixed(1)}% — monitor for natural language.`,
      priority: "LOW",
      evidence: [buildEvidence("keyword", "density", density)],
    });
  }

  if (!inDescription && occurrences > 0) {
    findings.push({
      ruleId: "KEYWORD_NOT_IN_DESCRIPTION",
      title: "Keyword not in meta description",
      description: "Consider natural inclusion in meta description if relevant.",
      priority: "LOW",
      evidence: [buildEvidence("crawl", "description", input.description)],
    });
  }

  for (const conflict of input.conflictingPages ?? []) {
    findings.push({
      ruleId: "CONFLICTING_TARGET_PAGE",
      title: "Conflicting target page",
      description: `Page ${conflict.url} also targets "${conflict.keyword}".`,
      priority: "MEDIUM",
      evidence: [
        buildEvidence("keyword", "conflictUrl", conflict.url),
        buildEvidence("keyword", "conflictKeyword", conflict.keyword),
      ],
    });
  }

  return findings;
}
