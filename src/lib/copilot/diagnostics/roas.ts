import type { CopilotFact, CopilotInference, CopilotRecommendation, EvidenceItem } from "@/lib/copilot/types";
import {
  createEvidence,
  createFact,
  createInference,
  createRecommendation,
  driverLabel,
  formatCurrency,
  formatMultiplier,
  formatPercent,
  resetEvidenceCounter,
} from "@/lib/copilot/format";

export type RoasDiagnosticInput = {
  currentRoas: number | null;
  previousRoas: number | null;
  currentSpend: number;
  previousSpend: number;
  currentRevenue: number;
  previousRevenue: number;
  providerBreakdown: Array<{
    provider: string;
    currentSpend: number;
    previousSpend: number;
    currentRevenue: number;
    previousRevenue: number;
    currentRoas: number | null;
    previousRoas: number | null;
    currentCpa: number | null;
    previousCpa: number | null;
    currentCtr: number | null;
    previousCtr: number | null;
    conversions: number;
  }>;
  periodLabel: string;
};

export type RoasDiagnosticResult = {
  facts: CopilotFact[];
  inferences: CopilotInference[];
  recommendations: CopilotRecommendation[];
  evidence: EvidenceItem[];
  summary: string;
  driverSummary: string[];
};

export function diagnoseRoasChange(input: RoasDiagnosticInput): RoasDiagnosticResult {
  resetEvidenceCounter();
  const evidence: EvidenceItem[] = [];
  const facts: CopilotFact[] = [];
  const inferences: CopilotInference[] = [];
  const recommendations: CopilotRecommendation[] = [];

  if (input.currentRoas == null || input.previousRoas == null || input.previousRoas <= 0) {
    const ev = createEvidence({
      label: "ROAS data",
      metric: "roas",
      value: "Unavailable",
      source: "Paid performance",
      limitations: ["Insufficient paid spend or revenue data."],
    });
    return {
      facts: [createFact("ROAS cannot be calculated for the selected period.", [ev.id])],
      inferences: [],
      recommendations: [
        createRecommendation("Connect paid ad accounts and ensure revenue tracking is configured.", [ev.id]),
      ],
      evidence: [ev],
      summary: "I cannot diagnose ROAS change because paid revenue or spend data is unavailable.",
      driverSummary: [],
    };
  }

  const roasChange = ((input.currentRoas - input.previousRoas) / input.previousRoas) * 100;
  const roasEv = createEvidence({
    label: "Blended ROAS",
    metric: "roas",
    value: formatMultiplier(input.currentRoas),
    previousValue: formatMultiplier(input.previousRoas),
    source: "Paid performance + attributed revenue",
  });
  evidence.push(roasEv);
  facts.push(
    createFact(
      `ROAS ${roasChange < 0 ? "declined" : "increased"} from ${formatMultiplier(input.previousRoas)} to ${formatMultiplier(input.currentRoas)} (${formatPercent(roasChange)}) during ${input.periodLabel}.`,
      [roasEv.id],
    ),
  );

  const spendEv = createEvidence({
    label: "Paid spend",
    metric: "spend",
    value: formatCurrency(input.currentSpend),
    previousValue: formatCurrency(input.previousSpend),
    source: "MarketingCostRecord",
  });
  evidence.push(spendEv);
  if (input.previousSpend > 0) {
    const spendChange = ((input.currentSpend - input.previousSpend) / input.previousSpend) * 100;
    facts.push(
      createFact(`Paid spend changed ${formatPercent(spendChange)} (${formatCurrency(input.previousSpend)} → ${formatCurrency(input.currentSpend)}).`, [spendEv.id]),
    );
  }

  const revenueEv = createEvidence({
    label: "Attributed revenue",
    metric: "attributedRevenue",
    value: formatCurrency(input.currentRevenue),
    previousValue: formatCurrency(input.previousRevenue),
    source: "Attribution journeys",
  });
  evidence.push(revenueEv);

  const drivers = input.providerBreakdown
    .map((row) => {
      const roasDelta =
        row.currentRoas != null && row.previousRoas != null && row.previousRoas > 0
          ? row.currentRoas - row.previousRoas
          : 0;
      const spendShare = input.currentSpend > 0 ? row.currentSpend / input.currentSpend : 0;
      return { ...row, roasDelta, spendShare, impact: Math.abs(roasDelta) * spendShare };
    })
    .filter((row) => row.currentSpend > 0 || row.previousSpend > 0)
    .sort((a, b) => b.impact - a.impact);

  const driverSummary: string[] = [];
  for (const [index, driver] of drivers.slice(0, 4).entries()) {
    const rank = index === 0 ? "primary" : index === 1 ? "secondary" : "minor";
    const ev = createEvidence({
      label: `${driver.provider} ROAS`,
      metric: "roas",
      value: driver.currentRoas != null ? formatMultiplier(driver.currentRoas) : "—",
      previousValue: driver.previousRoas != null ? formatMultiplier(driver.previousRoas) : "—",
      source: `${driver.provider} provider metrics`,
      entityType: "channel",
    });
    evidence.push(ev);

    if (driver.currentRoas != null && driver.previousRoas != null) {
      facts.push(
        createFact(
          `${driver.provider} ROAS moved from ${formatMultiplier(driver.previousRoas)} to ${formatMultiplier(driver.currentRoas)}.`,
          [ev.id],
        ),
      );
      driverSummary.push(`${driverLabel(rank)}: ${driver.provider}`);
    }

    if (
      driver.currentCpa != null &&
      driver.previousCpa != null &&
      driver.previousCpa > 0 &&
      driver.currentCpa > driver.previousCpa * 1.15
    ) {
      const cpaChange = ((driver.currentCpa - driver.previousCpa) / driver.previousCpa) * 100;
      facts.push(
        createFact(`${driver.provider} CPA increased ${formatPercent(cpaChange)} while spend share was ${(driver.spendShare * 100).toFixed(0)}%.`, [ev.id]),
      );
    }

    if (
      driver.currentCtr != null &&
      driver.previousCtr != null &&
      driver.previousCtr > 0 &&
      driver.currentCtr < driver.previousCtr * 0.85
    ) {
      const ctrChange = ((driver.currentCtr - driver.previousCtr) / driver.previousCtr) * 100;
      inferences.push(
        createInference(
          `${driver.provider} CTR declined ${formatPercent(ctrChange)}, which may indicate creative fatigue or weaker audience response.`,
          [ev.id],
        ),
      );
    }
  }

  const weakest = drivers.find((row) => row.currentRoas != null && row.currentRoas < input.currentRoas * 0.75);
  if (weakest && input.currentRoas != null && weakest.currentRoas != null && weakest.currentRoas < input.currentRoas * 0.75) {
    recommendations.push(
      createRecommendation(
        `Review ${weakest.provider} campaigns and creatives with below-average ROAS before increasing spend.`,
        evidence.map((item) => item.id),
      ),
    );
  }

  const summary =
    roasChange < 0
      ? `ROAS declined during ${input.periodLabel}. ${driverSummary[0] ? `${driverSummary[0]} appears most influential.` : ""}`
      : `ROAS improved during ${input.periodLabel}.`;

  return { facts, inferences, recommendations, evidence, summary, driverSummary };
}
