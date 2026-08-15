import { Prisma } from "@prisma/client";
import { ANALYTICS_METRIC_KEYS, DERIVED_METRIC_KEYS } from "@/lib/analytics-core/constants";
import {
  divideDecimal,
  multiplyDecimal,
  percentOf,
  toDecimal,
} from "@/lib/analytics-core/decimal";
import { isDerivedMetricKey } from "@/lib/analytics-core/metric-registry";

export type MetricTotals = Partial<Record<string, Prisma.Decimal | number | string | null>>;

export type DerivedMetricResult = {
  metricKey: string;
  value: Prisma.Decimal | null;
  missingInputs: string[];
};

function readTotal(totals: MetricTotals, key: string): Prisma.Decimal | null {
  const raw = totals[key];
  if (raw === null || raw === undefined) return null;
  const decimal = toDecimal(raw);
  return decimal.isNaN() ? null : decimal;
}

export function computeDerivedMetric(metricKey: string, totals: MetricTotals): DerivedMetricResult {
  const missingInputs: string[] = [];

  const requireInput = (key: string) => {
    const value = readTotal(totals, key);
    if (value === null) {
      missingInputs.push(key);
      return null;
    }
    return value;
  };

  switch (metricKey) {
    case ANALYTICS_METRIC_KEYS.CTR: {
      const clicks = requireInput(ANALYTICS_METRIC_KEYS.CLICKS);
      const impressions = requireInput(ANALYTICS_METRIC_KEYS.IMPRESSIONS);
      return {
        metricKey,
        value: clicks && impressions ? percentOf(clicks, impressions) : null,
        missingInputs,
      };
    }
    case ANALYTICS_METRIC_KEYS.CPC: {
      const spend = requireInput(ANALYTICS_METRIC_KEYS.SPEND);
      const clicks = requireInput(ANALYTICS_METRIC_KEYS.CLICKS);
      return {
        metricKey,
        value: spend && clicks ? divideDecimal(spend, clicks) : null,
        missingInputs,
      };
    }
    case ANALYTICS_METRIC_KEYS.CPM: {
      const spend = requireInput(ANALYTICS_METRIC_KEYS.SPEND);
      const impressions = requireInput(ANALYTICS_METRIC_KEYS.IMPRESSIONS);
      const ratio = spend && impressions ? divideDecimal(spend, impressions) : null;
      return {
        metricKey,
        value: ratio ? multiplyDecimal(ratio, 1000) : null,
        missingInputs,
      };
    }
    case ANALYTICS_METRIC_KEYS.CPL: {
      const spend = requireInput(ANALYTICS_METRIC_KEYS.SPEND);
      const leads = requireInput(ANALYTICS_METRIC_KEYS.LEADS);
      return {
        metricKey,
        value: spend && leads ? divideDecimal(spend, leads) : null,
        missingInputs,
      };
    }
    case ANALYTICS_METRIC_KEYS.CPA: {
      const spend = requireInput(ANALYTICS_METRIC_KEYS.SPEND);
      const conversions = requireInput(ANALYTICS_METRIC_KEYS.CONVERSIONS);
      return {
        metricKey,
        value: spend && conversions ? divideDecimal(spend, conversions) : null,
        missingInputs,
      };
    }
    case ANALYTICS_METRIC_KEYS.ROAS: {
      const revenue = requireInput(ANALYTICS_METRIC_KEYS.REVENUE);
      const spend = requireInput(ANALYTICS_METRIC_KEYS.SPEND);
      return {
        metricKey,
        value: revenue && spend ? divideDecimal(revenue, spend) : null,
        missingInputs,
      };
    }
    case ANALYTICS_METRIC_KEYS.CONVERSION_RATE: {
      const conversions = requireInput(ANALYTICS_METRIC_KEYS.CONVERSIONS);
      const sessions = readTotal(totals, ANALYTICS_METRIC_KEYS.SESSIONS);
      const clicks = readTotal(totals, ANALYTICS_METRIC_KEYS.CLICKS);
      const denominator = sessions && !sessions.isZero() ? sessions : clicks;
      if (!denominator || denominator.isZero()) {
        missingInputs.push(ANALYTICS_METRIC_KEYS.SESSIONS, ANALYTICS_METRIC_KEYS.CLICKS);
      }
      return {
        metricKey,
        value: conversions && denominator ? percentOf(conversions, denominator) : null,
        missingInputs,
      };
    }
    default:
      return { metricKey, value: null, missingInputs: ["unknown_metric"] };
  }
}

export function computeAllDerivedMetrics(totals: MetricTotals): Record<string, DerivedMetricResult> {
  const results: Record<string, DerivedMetricResult> = {};
  for (const metricKey of DERIVED_METRIC_KEYS) {
    results[metricKey] = computeDerivedMetric(metricKey, totals);
  }
  return results;
}

export function assertBaseMetricImport(metricKey: string) {
  if (isDerivedMetricKey(metricKey)) {
    return {
      valid: false as const,
      error: `Derived metric "${metricKey}" cannot be imported directly; it is computed by the metric engine.`,
    };
  }
  return { valid: true as const };
}
