import type { CommunityOpportunity } from "@/lib/organic-growth/types";

/**
 * Community intelligence foundation.
 * Production data requires connected conversation sources — never fabricate live conversations.
 */
export function buildCommunityOpportunityArchitecture(): {
  supportedSources: string[];
  requiresHumanApproval: true;
  automatedPostingEnabled: false;
} {
  return {
    supportedSources: ["X", "LINKEDIN", "REDDIT", "THREADS", "BLUESKY"],
    requiresHumanApproval: true,
    automatedPostingEnabled: false,
  };
}

export function filterCommunityOpportunities(
  opportunities: CommunityOpportunity[],
  filters: {
    source?: string;
    relevance?: string;
    intent?: string;
  },
): CommunityOpportunity[] {
  return opportunities.filter((item) => {
    if (filters.source && item.source !== filters.source) return false;
    if (filters.relevance && item.relevance !== filters.relevance) return false;
    if (filters.intent && item.intent !== filters.intent) return false;
    return true;
  });
}
