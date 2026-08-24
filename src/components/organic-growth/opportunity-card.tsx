import type { OrganicOpportunity } from "@/lib/organic-growth/types";
import type { MarketingSignal } from "@/lib/marketing-intelligence/types";
import { RecommendationCard } from "@/components/command-centre/recommendation-card";

function toMarketingSignal(opportunity: OrganicOpportunity): MarketingSignal {
  return {
    id: opportunity.id,
    type: "organic",
    severity: opportunity.confidence === "high" ? "high" : "medium",
    title: opportunity.title,
    explanation: opportunity.finding,
    evidence: opportunity.evidence,
    estimatedImpact: opportunity.potentialImpact,
    action: opportunity.action,
    category: "organic",
    generatedAt: new Date().toISOString(),
    confidence:
      opportunity.confidence === "high" ? 0.85 : opportunity.confidence === "medium" ? 0.65 : 0.4,
  };
}

export function OpportunityCard({ opportunity }: { opportunity: OrganicOpportunity }) {
  return <RecommendationCard signal={toMarketingSignal(opportunity)} />;
}
