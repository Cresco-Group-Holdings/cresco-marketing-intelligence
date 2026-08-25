import type { UnifiedKpi } from "@/lib/unified-analytics/types";
import { unavailableValue } from "@/lib/marketing-intelligence/format";

function formatCurrency(value: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString("en-GB");
}

export function buildUnifiedKpis(input: {
  paidSpend: number;
  previousPaidSpend: number;
  attributedRevenue: number | null;
  previousAttributedRevenue: number | null;
  observedRevenue: number | null;
  conversions: number;
  previousConversions: number;
  paidConversions: number;
  organicContributionRevenue: number | null;
  paidContributionRevenue: number | null;
  contentAssistedRevenue: number | null;
  organicReach: number | null;
  previousOrganicReach: number | null;
  webSessions: number | null;
  previousWebSessions: number | null;
  attributionModelLabel: string;
  revenueCoveragePercent: number | null;
  paidSpendCoveragePercent: number | null;
  showComparison: boolean;
  comparisonLabel: string;
  currency?: string;
}): UnifiedKpi[] {
  const currency = input.currency ?? "GBP";
  const cpa =
    input.conversions > 0 && input.paidSpend > 0 ? input.paidSpend / input.conversions : null;
  const blendedRoas =
    input.paidSpend > 0 && input.attributedRevenue != null && input.attributedRevenue > 0
      ? input.attributedRevenue / input.paidSpend
      : null;

  return [
    {
      label: "Total Marketing Spend",
      value: input.paidSpend > 0 ? formatCurrency(input.paidSpend, currency) : unavailableValue(),
      change: input.showComparison
        ? input.previousPaidSpend > 0
          ? ((input.paidSpend - input.previousPaidSpend) / input.previousPaidSpend) * 100
          : null
        : null,
      comparisonLabel: input.comparisonLabel,
      metadata: {
        kind: "Observed",
        source: ["MarketingCostRecord", "paid metric observations"],
        limitations: ["Organic production costs not included unless separately tracked."],
      },
      footnote: "Paid spend only",
    },
    {
      label: "Attributed Revenue",
      value:
        input.attributedRevenue != null
          ? formatCurrency(input.attributedRevenue, currency)
          : unavailableValue(),
      change:
        input.showComparison &&
        input.attributedRevenue != null &&
        input.previousAttributedRevenue != null &&
        input.previousAttributedRevenue > 0
          ? ((input.attributedRevenue - input.previousAttributedRevenue) /
              input.previousAttributedRevenue) *
            100
          : null,
      comparisonLabel: input.comparisonLabel,
      metadata: {
        kind: "Attributed",
        attributionModel: input.attributionModelLabel,
        coverage: input.revenueCoveragePercent,
      },
      footnote:
        input.revenueCoveragePercent != null
          ? `Coverage: ${input.revenueCoveragePercent.toFixed(0)}%`
          : undefined,
    },
    {
      label: "Blended ROAS",
      value: blendedRoas != null ? `${blendedRoas.toFixed(2)}x` : unavailableValue(),
      change: null,
      comparisonLabel: input.comparisonLabel,
      metadata: {
        kind: "Calculated",
        limitations: ["Attributed Revenue / Total Paid Spend"],
        coverage: input.revenueCoveragePercent,
      },
      footnote:
        input.paidSpendCoveragePercent != null
          ? `Revenue coverage: ${input.revenueCoveragePercent?.toFixed(0) ?? "—"}% · Spend: ${input.paidSpendCoveragePercent.toFixed(0)}%`
          : undefined,
    },
    {
      label: "Conversions",
      value: input.conversions > 0 ? formatNumber(input.conversions) : unavailableValue(),
      change:
        input.showComparison && input.previousConversions > 0
          ? ((input.conversions - input.previousConversions) / input.previousConversions) * 100
          : null,
      comparisonLabel: input.comparisonLabel,
      metadata: { kind: "Observed", source: ["Attribution journeys", "provider conversions"] },
    },
    {
      label: "CPA",
      value: cpa != null ? formatCurrency(cpa, currency) : unavailableValue(),
      change: null,
      comparisonLabel: input.comparisonLabel,
      metadata: {
        kind: "Calculated",
        limitations: ["Paid Spend / attributed conversions. Not equivalent to CAC unless conversions represent acquired customers."],
      },
    },
    {
      label: "Organic Contribution",
      value:
        input.organicContributionRevenue != null
          ? formatCurrency(input.organicContributionRevenue, currency)
          : unavailableValue(),
      change: null,
      comparisonLabel: input.comparisonLabel,
      metadata: {
        kind: "Attributed",
        attributionModel: input.attributionModelLabel,
        limitations: ["Model-dependent channel credit to organic touchpoints."],
      },
    },
    {
      label: "Paid Contribution",
      value:
        input.paidContributionRevenue != null
          ? formatCurrency(input.paidContributionRevenue, currency)
          : unavailableValue(),
      change: null,
      comparisonLabel: input.comparisonLabel,
      metadata: {
        kind: "Attributed",
        attributionModel: input.attributionModelLabel,
      },
    },
    {
      label: "Content-Assisted Revenue",
      value:
        input.contentAssistedRevenue != null
          ? formatCurrency(input.contentAssistedRevenue, currency)
          : unavailableValue(),
      change: null,
      comparisonLabel: input.comparisonLabel,
      metadata: {
        kind: "Calculated",
        limitations: [
          "Revenue from journeys where content appeared before conversion. Distinct from attributed revenue.",
        ],
      },
    },
    {
      label: "Organic Reach",
      value:
        input.organicReach != null && input.organicReach > 0
          ? formatNumber(input.organicReach)
          : unavailableValue(),
      change:
        input.showComparison &&
        input.organicReach != null &&
        input.previousOrganicReach != null &&
        input.previousOrganicReach > 0
          ? ((input.organicReach - input.previousOrganicReach) / input.previousOrganicReach) * 100
          : null,
      comparisonLabel: input.comparisonLabel,
      metadata: { kind: "Observed", source: ["Social analytics providers"] },
    },
    {
      label: "Website Sessions",
      value:
        input.webSessions != null && input.webSessions > 0
          ? formatNumber(input.webSessions)
          : unavailableValue(),
      change:
        input.showComparison &&
        input.webSessions != null &&
        input.previousWebSessions != null &&
        input.previousWebSessions > 0
          ? ((input.webSessions - input.previousWebSessions) / input.previousWebSessions) * 100
          : null,
      comparisonLabel: input.comparisonLabel,
      metadata: { kind: "Observed", source: ["GA4"] },
    },
  ];
}

/** Returns the launch-priority overview KPI strip (up to 6 cards with valid data). */
export function buildOverviewKpiStrip(allKpis: UnifiedKpi[]): UnifiedKpi[] {
  const priorityLabels = [
    "Total Marketing Spend",
    "Attributed Revenue",
    "Conversions",
    "Blended ROAS",
    "Organic Reach",
    "Website Sessions",
  ];

  return priorityLabels
    .map((label) => allKpis.find((kpi) => kpi.label === label))
    .filter((kpi): kpi is UnifiedKpi => kpi != null && kpi.value !== unavailableValue())
    .slice(0, 6);
}
