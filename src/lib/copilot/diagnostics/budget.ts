import type { CopilotFact, CopilotRecommendation, EvidenceItem } from "@/lib/copilot/types";
import {
  createEvidence,
  createFact,
  createRecommendation,
  formatCurrency,
  formatMultiplier,
  resetEvidenceCounter,
} from "@/lib/copilot/format";

export type BudgetAnalysisInput = {
  amount: number;
  channels: Array<{
    channel: string;
    roas: number | null;
    cpa: number | null;
    spend: number;
    spendShare: number;
    conversions: number;
    trend: "improving" | "stable" | "declining" | "unknown";
    freshness: string;
  }>;
  limitations: string[];
};

export function analyseBudgetReallocation(input: BudgetAnalysisInput): {
  facts: CopilotFact[];
  recommendations: CopilotRecommendation[];
  evidence: EvidenceItem[];
  summary: string;
} {
  resetEvidenceCounter();
  const evidence: EvidenceItem[] = [];
  const facts: CopilotFact[] = [];
  const recommendations: CopilotRecommendation[] = [];

  const eligible = input.channels
    .filter((row) => row.conversions >= 20 && row.spend > 0 && row.roas != null)
    .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0));

  const weak = input.channels
    .filter((row) => row.conversions >= 20 && row.spend > 0 && row.roas != null)
    .sort((a, b) => (a.roas ?? 0) - (b.roas ?? 0));

  if (eligible.length === 0) {
    const ev = createEvidence({
      label: "Budget analysis",
      value: "Insufficient sample",
      limitations: input.limitations,
    });
    return {
      facts: [createFact("Insufficient conversion volume to recommend budget reallocation safely.", [ev.id])],
      recommendations: [
        createRecommendation("Gather more conversion data before reallocating budget.", [ev.id]),
      ],
      evidence: [ev],
      summary: `I cannot recommend where to move ${formatCurrency(input.amount)} because sample sizes are too small.`,
    };
  }

  const top = eligible.slice(0, 2);
  for (const channel of top) {
    const ev = createEvidence({
      label: channel.channel,
      metric: "roas",
      value: channel.roas != null ? formatMultiplier(channel.roas) : "—",
      source: "Paid performance",
      sampleSize: channel.conversions,
      freshness: channel.freshness,
    });
    evidence.push(ev);
    facts.push(
      createFact(
        `${channel.channel}: ROAS ${channel.roas != null ? formatMultiplier(channel.roas) : "—"}, CPA ${channel.cpa != null ? formatCurrency(channel.cpa) : "—"}, ${channel.conversions} conversions, spend share ${(channel.spendShare * 100).toFixed(0)}%.`,
        [ev.id],
      ),
    );
  }

  const lowPriority = weak[0];
  if (lowPriority && (top[0]?.roas ?? 0) > (lowPriority.roas ?? 0) * 1.3) {
    const weakEv = createEvidence({
      label: lowPriority.channel,
      metric: "roas",
      value: lowPriority.roas != null ? formatMultiplier(lowPriority.roas) : "—",
      source: "Paid performance",
      sampleSize: lowPriority.conversions,
    });
    evidence.push(weakEv);
    facts.push(
      createFact(`${lowPriority.channel} shows weaker efficiency relative to top channels.`, [weakEv.id]),
    );
  }

  const primary = top[0];
  const secondary = top[1];
  const primaryAmount = Math.round(input.amount * 0.65);
  const secondaryAmount = input.amount - primaryAmount;

  recommendations.push(
    createRecommendation(
      primary
        ? `Consider testing a ${formatCurrency(primaryAmount)} increase toward ${primary.channel} rather than moving the full ${formatCurrency(input.amount)} at once.`
        : "Review channel efficiency before reallocating budget.",
      evidence.map((item) => item.id),
    ),
  );
  if (secondary) {
    recommendations.push(
      createRecommendation(
        `A secondary test allocation of ${formatCurrency(secondaryAmount)} toward ${secondary.channel} may be appropriate if capacity exists.`,
        evidence.map((item) => item.id),
      ),
    );
  }

  return {
    facts,
    recommendations,
    evidence,
    summary: `For ${formatCurrency(input.amount)} available, Cresco reviewed channel efficiency using ROAS, CPA, sample size, and spend share. This is advisory only.`,
  };
}

export function extractBudgetAmount(question: string): number | null {
  const match = question.match(/£\s?([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s?(?:pounds|gbp)/i);
  if (!match) return null;
  const raw = (match[1] ?? match[2] ?? "").replace(/,/g, "");
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}
