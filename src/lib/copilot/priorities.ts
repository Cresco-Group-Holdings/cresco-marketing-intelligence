import type {
  CopilotConfidence,
  CopilotSuggestedAction,
  EvidenceItem,
} from "@/lib/copilot/types";

export type MarketingPriority = {
  id: string;
  title: string;
  reason: string;
  impact: "low" | "medium" | "high";
  urgency: "low" | "medium" | "high";
  confidence: CopilotConfidence["level"];
  evidence: EvidenceItem[];
  action?: CopilotSuggestedAction;
  score: number;
};

type PriorityCandidate = Omit<MarketingPriority, "score"> & { score?: number };

const IMPACT_SCORE = { low: 1, medium: 2, high: 3 } as const;
const URGENCY_SCORE = { low: 1, medium: 2, high: 3 } as const;
const CONFIDENCE_SCORE = { insufficient: 0, limited: 1, moderate: 2, high: 3 } as const;

export function rankMarketingPriorities(candidates: PriorityCandidate[]): MarketingPriority[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      score:
        candidate.score ??
        IMPACT_SCORE[candidate.impact] * 3 +
          URGENCY_SCORE[candidate.urgency] * 2 +
          CONFIDENCE_SCORE[candidate.confidence],
    }))
    .sort((a, b) => b.score - a.score);
}
