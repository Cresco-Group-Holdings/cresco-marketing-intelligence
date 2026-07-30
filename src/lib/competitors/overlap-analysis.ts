import type { SeoKeywordOverlapType } from "@prisma/client";

export type BrandKeyword = {
  id?: string;
  keyword: string;
  normalisedKeyword: string;
  position?: number | null;
  url?: string | null;
};

export type CompetitorKeyword = {
  id?: string;
  keyword: string;
  normalisedKeyword: string;
  position?: number | null;
  url?: string | null;
  source?: string;
};

export type OverlapResult = {
  keyword: string;
  overlapType: SeoKeywordOverlapType;
  brandKeyword?: BrandKeyword;
  competitorKeyword?: CompetitorKeyword;
  sourceCoverage: {
    hasBrandData: boolean;
    hasCompetitorData: boolean;
    brandSource?: string;
    competitorSource?: string;
  };
  evidence: Record<string, unknown>;
};

export function calculateKeywordOverlaps(
  brandKeywords: BrandKeyword[],
  competitorKeywords: CompetitorKeyword[],
): OverlapResult[] {
  const brandMap = new Map(brandKeywords.map((k) => [k.normalisedKeyword, k]));
  const competitorMap = new Map(competitorKeywords.map((k) => [k.normalisedKeyword, k]));
  const allKeys = new Set([...brandMap.keys(), ...competitorMap.keys()]);
  const results: OverlapResult[] = [];

  for (const key of allKeys) {
    const brand = brandMap.get(key);
    const competitor = competitorMap.get(key);

    let overlapType: SeoKeywordOverlapType;
    if (brand && competitor) overlapType = "SHARED";
    else if (brand) overlapType = "BRAND_UNIQUE";
    else overlapType = "COMPETITOR_UNIQUE";

    results.push({
      keyword: brand?.keyword ?? competitor!.keyword,
      overlapType,
      brandKeyword: brand,
      competitorKeyword: competitor,
      sourceCoverage: {
        hasBrandData: !!brand,
        hasCompetitorData: !!competitor,
        brandSource: brand ? "brand_keywords" : undefined,
        competitorSource: competitor?.source,
      },
      evidence: {
        brandPosition: brand?.position ?? null,
        competitorPosition: competitor?.position ?? null,
        brandUrl: brand?.url ?? null,
        competitorUrl: competitor?.url ?? null,
        missingData: !brand || !competitor,
      },
    });
  }

  return results;
}

export function overlapSummary(overlaps: OverlapResult[]) {
  return {
    shared: overlaps.filter((o) => o.overlapType === "SHARED").length,
    brandUnique: overlaps.filter((o) => o.overlapType === "BRAND_UNIQUE").length,
    competitorUnique: overlaps.filter((o) => o.overlapType === "COMPETITOR_UNIQUE").length,
    withMissingSource: overlaps.filter((o) => !o.sourceCoverage.hasBrandData || !o.sourceCoverage.hasCompetitorData).length,
  };
}
