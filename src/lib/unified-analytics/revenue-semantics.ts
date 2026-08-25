import { aggregateCrossProviderSpend } from "@/lib/advertising-budget-governance/currency";
import type { FxRate } from "@/lib/advertising-budget-governance/currency";
import { unavailableValue } from "@/lib/marketing-intelligence/format";
import type { ChannelAttributionAggregate } from "@/lib/unified-analytics/attribution";

export type RevenueSemantics = {
  observedRevenue: number | null;
  attributedRevenue: number | null;
  unattributedRevenue: number | null;
  /** Cresco does not expose influenced revenue without a separate defensible methodology. */
  influencedRevenue: null;
  paidAttributedRevenue: number | null;
};

const PAID_CHANNEL_KEYS = ["GOOGLE", "META", "TIKTOK", "LINKEDIN"] as const;

export function isPaidAttributionChannel(channel: string | null | undefined): boolean {
  if (!channel) return false;
  const upper = channel.toUpperCase();
  return (
    upper.includes("ADS") ||
    PAID_CHANNEL_KEYS.some((key) => upper.includes(key) && (upper.includes("AD") || upper.includes("ADS")))
  );
}

export function resolveAttributedRevenue(value: number | null | undefined): number | null {
  if (value == null || value <= 0) return null;
  return value;
}

export function resolveObservedRevenue(value: number | null | undefined): number | null {
  if (value == null) return null;
  return value;
}

export function resolveUnattributedRevenue(
  observedRevenue: number | null,
  attributedRevenue: number | null,
): number | null {
  if (observedRevenue == null) return null;
  if (attributedRevenue == null || attributedRevenue <= 0) return observedRevenue;
  return Math.max(0, observedRevenue - attributedRevenue);
}

export function resolvePaidAttributedRevenue(
  channelBreakdown: ChannelAttributionAggregate[],
): number | null {
  const paidTotal = channelBreakdown
    .filter((row) => isPaidAttributionChannel(row.channel))
    .reduce((sum, row) => sum + row.creditValue, 0);
  return paidTotal > 0 ? paidTotal : null;
}

export function resolveRevenueSemantics(input: {
  observedRevenue: number | null;
  attributedRevenue: number | null;
  channelBreakdown?: ChannelAttributionAggregate[];
}): RevenueSemantics {
  const observed = resolveObservedRevenue(input.observedRevenue);
  const attributed = resolveAttributedRevenue(input.attributedRevenue);

  return {
    observedRevenue: observed,
    attributedRevenue: attributed,
    unattributedRevenue: resolveUnattributedRevenue(observed, attributed),
    influencedRevenue: null,
    paidAttributedRevenue: resolvePaidAttributedRevenue(input.channelBreakdown ?? []),
  };
}

/**
 * Blended ROAS is only valid when paid-attributable revenue exists.
 * Never substitute global observed revenue into paid ROAS.
 */
export function resolveBlendedRoas(
  paidSpend: number,
  paidAttributedRevenue: number | null,
): number | null {
  if (paidSpend <= 0 || paidAttributedRevenue == null || paidAttributedRevenue <= 0) {
    return null;
  }
  return paidAttributedRevenue / paidSpend;
}

function formatCurrency(value: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export type CommandCentreAttributedRevenueKpi = {
  label: "Attributed Revenue";
  value: string;
  state: "normal" | "empty";
  stateMessage?: string;
};

export function buildCommandCentreAttributedRevenueKpi(
  attributedRevenue: number | null,
  currency = "GBP",
): CommandCentreAttributedRevenueKpi {
  const hasAttribution = attributedRevenue != null && attributedRevenue > 0;
  return {
    label: "Attributed Revenue",
    value: hasAttribution ? formatCurrency(attributedRevenue, currency) : unavailableValue(),
    state: hasAttribution ? "normal" : "empty",
    stateMessage: hasAttribution
      ? undefined
      : "Attribution unavailable for the selected period. Connect revenue and journey data to unlock attributed revenue.",
  };
}

export function resolveMixedCurrencyRevenueTotal(input: {
  observations: Array<{ amount: number; currency: string; provider: string }>;
  reportingCurrency: string;
  rates: FxRate[];
}): {
  total: number | null;
  reportingCurrency: string;
  unavailable: boolean;
  warnings: string[];
} {
  const result = aggregateCrossProviderSpend({
    observations: input.observations,
    reportingCurrency: input.reportingCurrency,
    rates: input.rates,
  });

  const hasMissingRates = result.lineItems.some((item) => item.fxRateMissing);
  if (hasMissingRates) {
    return {
      total: null,
      reportingCurrency: input.reportingCurrency,
      unavailable: true,
      warnings: result.missingRateWarnings,
    };
  }

  return {
    total: result.total,
    reportingCurrency: input.reportingCurrency,
    unavailable: false,
    warnings: result.missingRateWarnings,
  };
}
