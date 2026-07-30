import type { SeoContentGapType } from "@prisma/client";

export type ContentGapCandidate = {
  gapType: SeoContentGapType;
  topic?: string;
  keyword?: string;
  title: string;
  explanation: string;
  evidence: Record<string, unknown>;
  recommendedAction: string;
  originalityGuidance: string;
};

export type BrandPageSummary = {
  url: string;
  title?: string;
  wordCount?: number;
  topics?: string[];
  contentType?: string;
};

export type CompetitorPageSummary = {
  url: string;
  title?: string;
  wordCount?: number;
  topics?: string[];
  contentType?: string;
};

export function detectContentGaps(input: {
  brandPages: BrandPageSummary[];
  competitorPages: CompetitorPageSummary[];
  competitorTopics: string[];
  brandTopics: string[];
  keywordGaps: Array<{ keyword: string; competitorUrl?: string; brandUrl?: string }>;
}): ContentGapCandidate[] {
  const gaps: ContentGapCandidate[] = [];
  const brandTopicSet = new Set(input.brandTopics.map((t) => t.toLowerCase()));

  for (const topic of input.competitorTopics) {
    if (!brandTopicSet.has(topic.toLowerCase())) {
      const competitorPages = input.competitorPages.filter((p) =>
        p.topics?.some((t) => t.toLowerCase() === topic.toLowerCase()),
      );
      gaps.push({
        gapType: "TOPIC_COVERAGE",
        topic,
        title: `Topic gap: ${topic}`,
        explanation: `Competitor covers "${topic}" with ${competitorPages.length} page(s); brand has no matching topic coverage.`,
        evidence: { topic, competitorPageCount: competitorPages.length, competitorUrls: competitorPages.map((p) => p.url).slice(0, 5) },
        recommendedAction: "Evaluate whether this topic aligns with brand strategy before creating content.",
        originalityGuidance: "Develop original perspective — do not copy competitor content.",
      });
    }
  }

  for (const kw of input.keywordGaps) {
    if (kw.competitorUrl && !kw.brandUrl) {
      gaps.push({
        gapType: "MISSING_PAGE",
        keyword: kw.keyword,
        title: `Missing page for "${kw.keyword}"`,
        explanation: `Competitor ranks with ${kw.competitorUrl}; brand has no mapped page.`,
        evidence: { keyword: kw.keyword, competitorUrl: kw.competitorUrl },
        recommendedAction: "Consider creating or mapping a relevant brand page if strategically aligned.",
        originalityGuidance: "Create unique content addressing user intent, not a replica of the competitor page.",
      });
    } else if (kw.competitorUrl && kw.brandUrl) {
      const brandPage = input.brandPages.find((p) => p.url === kw.brandUrl);
      const competitorPage = input.competitorPages.find((p) => p.url === kw.competitorUrl);
      if (
        brandPage &&
        competitorPage &&
        (brandPage.wordCount ?? 0) < (competitorPage.wordCount ?? 0) * 0.5
      ) {
        gaps.push({
          gapType: "WEAK_PAGE",
          keyword: kw.keyword,
          title: `Weak brand page for "${kw.keyword}"`,
          explanation: `Brand page has ~${brandPage.wordCount ?? 0} words vs competitor ~${competitorPage.wordCount ?? 0}.`,
          evidence: {
            keyword: kw.keyword,
            brandUrl: kw.brandUrl,
            competitorUrl: kw.competitorUrl,
            brandWordCount: brandPage.wordCount,
            competitorWordCount: competitorPage.wordCount,
          },
          recommendedAction: "Strengthen on-page depth and topical coverage on the brand page.",
          originalityGuidance: "Add unique insights and brand-specific value — avoid copying structure verbatim.",
        });
      }
    }
  }

  const brandFormats = new Set(input.brandPages.map((p) => p.contentType).filter(Boolean));
  const competitorFormats = new Set(input.competitorPages.map((p) => p.contentType).filter(Boolean));
  for (const format of competitorFormats) {
    if (format && !brandFormats.has(format)) {
      gaps.push({
        gapType: "MISSING_FORMAT",
        title: `Missing content format: ${format}`,
        explanation: `Competitor uses "${format}" content format not found on brand site.`,
        evidence: { format, competitorPageCount: input.competitorPages.filter((p) => p.contentType === format).length },
        recommendedAction: "Evaluate if this format serves your audience before adopting.",
        originalityGuidance: "Design format to match brand voice, not competitor templates.",
      });
    }
  }

  return gaps;
}
