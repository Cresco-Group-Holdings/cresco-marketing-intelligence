import type { CopilotIntent, CopilotModule, CopilotPageContext } from "@/lib/copilot/types";

type IntentPattern = {
  intent: CopilotIntent;
  patterns: RegExp[];
  modules?: CopilotModule[];
};

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: "brief",
    patterns: [/daily (marketing )?brief/i, /today('s)? (marketing )?summary/i, /what changed today/i],
  },
  {
    intent: "priorities",
    patterns: [
      /what should i do today/i,
      /top (5|five) (things|actions|priorities)/i,
      /most important (things|actions)/i,
      /priority/i,
    ],
  },
  {
    intent: "budget",
    patterns: [
      /move £?\d/i,
      /reallocat/i,
      /where should i (put|move|spend)/i,
      /wast(e|ing) (budget|money|spend)/i,
      /deserves more budget/i,
      /budget allocation/i,
    ],
  },
  {
    intent: "diagnosis",
    patterns: [
      /why did .* (decline|fall|drop|rise|increase|change)/i,
      /why is .* (down|up|low|high)/i,
      /what caused/i,
      /what happened to/i,
    ],
  },
  {
    intent: "attribution",
    patterns: [
      /attribution/i,
      /assist(ed)? revenue/i,
      /organic assist/i,
      /last touch|first touch|linear attribution/i,
      /meta reports more than cresco/i,
      /provider.*cresco/i,
      /contributes? (most )?to revenue/i,
    ],
  },
  {
    intent: "data-quality",
    patterns: [
      /can i trust/i,
      /data (missing|quality|coverage)/i,
      /why do .* disagree/i,
      /tracking (gap|issue|loss)/i,
      /measurement quality/i,
    ],
  },
  {
    intent: "content",
    patterns: [
      /what should (we |i )?publish/i,
      /repurpose/i,
      /become an ad/i,
      /become organic/i,
      /content (makes? money|contributes?|revenue)/i,
      /which (reel|video|post)/i,
    ],
    modules: ["content", "social"],
  },
  {
    intent: "publishing",
    patterns: [/publish next/i, /scheduled/i, /calendar/i, /posting gap/i],
    modules: ["social", "calendar"],
  },
  {
    intent: "paid",
    patterns: [/roas/i, /cpa/i, /campaign/i, /creative/i, /ad spend/i, /paid /i],
    modules: ["advertising"],
  },
  {
    intent: "organic",
    patterns: [/engagement/i, /reach/i, /reel/i, /organic/i, /instagram|tiktok|youtube/i],
    modules: ["social"],
  },
  {
    intent: "revenue",
    patterns: [/revenue/i, /mrr/i, /sales/i],
  },
  {
    intent: "conversion",
    patterns: [/conversion/i, /funnel/i, /drop.?off/i],
  },
  {
    intent: "comparison",
    patterns: [/compare/i, /versus|vs\.?/i, /previous (month|period)/i],
  },
  {
    intent: "performance",
    patterns: [/perform/i, /underperform/i, /top /i, /best /i, /worst /i],
  },
];

export function classifyIntent(question: string, pageContext: CopilotPageContext): CopilotIntent {
  const normalised = question.trim();
  const scores = new Map<CopilotIntent, number>();

  if (/why (did|is|has|are)/i.test(normalised)) {
    scores.set("diagnosis", (scores.get("diagnosis") ?? 0) + 3);
  }

  for (const entry of INTENT_PATTERNS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(normalised)) {
        const boost = entry.modules?.includes(pageContext.module) ? 2 : 1;
        scores.set(entry.intent, (scores.get(entry.intent) ?? 0) + boost);
      }
    }
  }

  if (pageContext.module === "advertising" && /which ones?|underperform/i.test(normalised)) {
    scores.set("paid", (scores.get("paid") ?? 0) + 2);
  }
  if (pageContext.module === "analytics" && /which (of )?these|made money/i.test(normalised)) {
    scores.set("attribution", (scores.get("attribution") ?? 0) + 2);
  }
  if (pageContext.module === "social" && /which should i reuse/i.test(normalised)) {
    scores.set("content", (scores.get("content") ?? 0) + 2);
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 0 && ranked[0]) {
    return ranked[0][0];
  }

  if (pageContext.module === "advertising") return "paid";
  if (pageContext.module === "social") return "organic";
  if (pageContext.module === "analytics") return "attribution";
  return "general";
}

export function toolsForIntent(intent: CopilotIntent): string[] {
  const map: Record<CopilotIntent, string[]> = {
    performance: ["getMarketingOverview", "getPaidPerformance", "getOrganicPerformance"],
    diagnosis: [
      "getMarketingOverview",
      "getPaidPerformance",
      "getCampaignPerformance",
      "getCreativePerformance",
      "getRevenueAnalytics",
      "getAttributionSummary",
    ],
    comparison: ["getMarketingOverview", "getPaidPerformance", "getOrganicPerformance"],
    budget: ["getPaidPerformance", "getCampaignPerformance", "getDataCoverage"],
    content: ["getContentPerformance", "getOrganicPerformance", "getPublishingSchedule"],
    organic: ["getOrganicPerformance", "getContentPerformance", "getPublishingSchedule"],
    paid: ["getPaidPerformance", "getCampaignPerformance", "getCreativePerformance"],
    attribution: ["getAttributionSummary", "getRevenueAnalytics", "getDataCoverage"],
    revenue: ["getRevenueAnalytics", "getAttributionSummary", "getMarketingOverview"],
    conversion: ["getMarketingOverview", "getAttributionSummary"],
    publishing: ["getPublishingSchedule", "getOrganicPerformance", "getContentPerformance"],
    planning: ["getMarketingOverview", "getPublishingSchedule", "getMarketingSignals"],
    "data-quality": ["getDataCoverage", "getAttributionSummary"],
    priorities: ["getMarketingSignals", "getMarketingOverview", "getDataCoverage"],
    brief: [
      "getMarketingOverview",
      "getPaidPerformance",
      "getOrganicPerformance",
      "getMarketingSignals",
      "getDataCoverage",
    ],
    general: ["getMarketingOverview", "getDataCoverage"],
  };
  return map[intent];
}
