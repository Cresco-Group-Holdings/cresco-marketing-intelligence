import type { SeoContentRefreshRecommendationType } from "@prisma/client";
import type { DecaySignal } from "@/lib/rank-tracking/content-decay";

export type RefreshRecommendationDraft = {
  recommendationType: SeoContentRefreshRecommendationType;
  evidence: Record<string, unknown>;
  confidence: number;
  expectedHypothesis: string;
  measurementPlan: string;
};

const SIGNAL_TO_RECOMMENDATIONS: Record<string, SeoContentRefreshRecommendationType[]> = {
  declining_clicks: ["IMPROVE_TITLE", "IMPROVE_DESCRIPTION", "REVIEW_SEARCH_INTENT"],
  declining_impressions: ["EXPAND_SECTION", "ADD_FAQ", "REVIEW_SEARCH_INTENT"],
  declining_ranking: ["EXPAND_SECTION", "ADD_INTERNAL_LINKS", "REVIEW_SEARCH_INTENT"],
  lower_ctr: ["IMPROVE_TITLE", "IMPROVE_DESCRIPTION"],
  stale_content: ["UPDATE_FACTS", "UPDATE_STATISTICS", "REWRITE_INTRODUCTION"],
  broken_links: ["FIX_TECHNICAL"],
  outdated_references: ["UPDATE_FACTS", "UPDATE_STATISTICS"],
  competitor_coverage_increase: ["EXPAND_SECTION", "ADD_FAQ", "CONSOLIDATE_CONTENT"],
  unresolved_on_page_issues: ["FIX_TECHNICAL", "IMPROVE_TITLE", "IMPROVE_DESCRIPTION"],
  internal_link_loss: ["ADD_INTERNAL_LINKS"],
};

export function generateRefreshRecommendations(
  signals: DecaySignal[],
  dateRangeStart: string,
  dateRangeEnd: string,
): RefreshRecommendationDraft[] {
  const recs: RefreshRecommendationDraft[] = [];
  const seen = new Set<string>();

  for (const signal of signals) {
    const types = SIGNAL_TO_RECOMMENDATIONS[signal.signal] ?? ["REVIEW_SEARCH_INTENT"];
    for (const type of types) {
      if (seen.has(type)) continue;
      seen.add(type);
      recs.push({
        recommendationType: type,
        evidence: { signal: signal.signal, ...signal.evidence },
        confidence: Math.min(0.95, 0.5 + signal.weight),
        expectedHypothesis: hypothesisForType(type),
        measurementPlan: measurementPlanForType(type, dateRangeStart, dateRangeEnd),
      });
    }
  }

  return recs.sort((a, b) => b.confidence - a.confidence);
}

function hypothesisForType(type: SeoContentRefreshRecommendationType): string {
  const map: Record<SeoContentRefreshRecommendationType, string> = {
    UPDATE_FACTS: "Updating outdated facts will restore relevance and user trust.",
    UPDATE_STATISTICS: "Fresh statistics will improve E-E-A-T and click appeal.",
    EXPAND_SECTION: "Expanded coverage will better match search intent and improve rankings.",
    IMPROVE_TITLE: "A more compelling title will improve CTR from search results.",
    IMPROVE_DESCRIPTION: "An optimised meta description will improve CTR.",
    ADD_FAQ: "FAQ content may capture featured snippets and long-tail queries.",
    ADD_INTERNAL_LINKS: "Additional internal links will improve crawlability and authority flow.",
    CONSOLIDATE_CONTENT: "Consolidating thin/duplicate content will strengthen topical authority.",
    FIX_TECHNICAL: "Resolving technical issues will remove ranking barriers.",
    REWRITE_INTRODUCTION: "A stronger introduction will reduce bounce rate and improve engagement.",
    IMPROVE_CTA: "A clearer CTA will improve conversion from organic traffic.",
    REVIEW_SEARCH_INTENT: "Aligning content with current search intent will recover visibility.",
    RETIRE_CONTENT: "Retiring obsolete content may improve site-wide quality signals.",
  };
  return map[type];
}

function measurementPlanForType(
  type: SeoContentRefreshRecommendationType,
  start: string,
  end: string,
): string {
  return `Compare GSC clicks, impressions, CTR, and average position for the target URL over 28 days post-implementation vs baseline (${start} to ${end}). Re-crawl to verify technical fixes.`;
}
