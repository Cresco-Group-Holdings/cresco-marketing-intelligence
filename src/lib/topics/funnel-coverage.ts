import type { SeoFunnelStage, SeoKeywordIntentType } from "@prisma/client";

export type FunnelCoverageItem = {
  stage: SeoFunnelStage;
  keywordCount: number;
  pageCount: number;
  hasContent: boolean;
};

const INTENT_TO_FUNNEL: Partial<Record<SeoKeywordIntentType, SeoFunnelStage>> = {
  INFORMATIONAL: "AWARENESS",
  COMMERCIAL: "CONSIDERATION",
  TRANSACTIONAL: "DECISION",
  NAVIGATIONAL: "ACTIVATION",
  LOCAL: "CONSIDERATION",
  SUPPORT: "SUPPORT",
};

export function mapIntentToFunnel(intent: SeoKeywordIntentType): SeoFunnelStage {
  return INTENT_TO_FUNNEL[intent] ?? "UNSPECIFIED";
}

export function calculateFunnelCoverage(input: {
  keywords: Array<{ intent: SeoKeywordIntentType; hasPage: boolean }>;
  pages: Array<{ funnelStage?: SeoFunnelStage }>;
}): FunnelCoverageItem[] {
  const stages: SeoFunnelStage[] = [
    "AWARENESS",
    "CONSIDERATION",
    "DECISION",
    "ACTIVATION",
    "RETENTION",
    "SUPPORT",
    "UNSPECIFIED",
  ];

  const counts = new Map<SeoFunnelStage, { keywords: number; pages: number }>();
  for (const stage of stages) counts.set(stage, { keywords: 0, pages: 0 });

  for (const kw of input.keywords) {
    const stage = mapIntentToFunnel(kw.intent);
    const c = counts.get(stage)!;
    c.keywords++;
    if (kw.hasPage) c.pages++;
  }

  for (const page of input.pages) {
    const stage = page.funnelStage ?? "UNSPECIFIED";
    const c = counts.get(stage)!;
    c.pages++;
  }

  return stages.map((stage) => {
    const c = counts.get(stage)!;
    return {
      stage,
      keywordCount: c.keywords,
      pageCount: c.pages,
      hasContent: c.pages > 0,
    };
  });
}
