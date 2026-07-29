import {
  WINNER_MIN_PERCENTAGE_DIFFERENCE,
  type ValidityWarning,
} from "@/lib/experiments/constants";

export type VariantMetricResult = {
  variantId: string;
  label: string;
  metricKey: string;
  rawValue: number;
  normalisedValue?: number | null;
  sampleSize: number;
  dataSufficient: boolean;
};

export type ExperimentConclusion = {
  outcome: "WINNER" | "LOSER" | "INCONCLUSIVE" | "NONE";
  winningVariantId: string | null;
  losingVariantId: string | null;
  absoluteDifference: number | null;
  percentageDifference: number | null;
  limitations: string[];
  dataSufficient: boolean;
};

export function normaliseMetric(
  rawValue: number,
  sampleSize: number,
  method?: string | null,
): number | null {
  if (!method || method === "none") return null;
  if (sampleSize <= 0) return null;
  if (method === "per_impression") return rawValue / sampleSize;
  if (method === "per_engagement") return rawValue / sampleSize;
  return null;
}

export function computePercentageDifference(control: number, variant: number): number | null {
  if (control === 0) return null;
  return ((variant - control) / Math.abs(control)) * 100;
}

export function concludeExperiment(input: {
  primaryMetricKey: string;
  minimumSampleThreshold: number;
  variantResults: VariantMetricResult[];
  validityWarnings: ValidityWarning[];
  decisionRule?: string;
}): ExperimentConclusion {
  const limitations: string[] = [];
  for (const warning of input.validityWarnings) {
    if (warning.severity !== "INFO") limitations.push(warning.message);
  }

  const primaryResults = input.variantResults.filter(
    (result) => result.metricKey === input.primaryMetricKey,
  );
  if (primaryResults.length < 2) {
    return {
      outcome: "INCONCLUSIVE",
      winningVariantId: null,
      losingVariantId: null,
      absoluteDifference: null,
      percentageDifference: null,
      limitations: [...limitations, "At least two variants with primary metric data are required."],
      dataSufficient: false,
    };
  }

  const insufficient = primaryResults.some(
    (result) => result.sampleSize < input.minimumSampleThreshold || !result.dataSufficient,
  );
  if (insufficient) {
    return {
      outcome: "INCONCLUSIVE",
      winningVariantId: null,
      losingVariantId: null,
      absoluteDifference: null,
      percentageDifference: null,
      limitations: [...limitations, "Insufficient data to reach the minimum sample threshold."],
      dataSufficient: false,
    };
  }

  const hasCriticalWarning = input.validityWarnings.some((warning) => warning.severity === "CRITICAL");
  if (hasCriticalWarning) {
    return {
      outcome: "INCONCLUSIVE",
      winningVariantId: null,
      losingVariantId: null,
      absoluteDifference: null,
      percentageDifference: null,
      limitations: [
        ...limitations,
        "Critical validity warnings prevent declaring a winner.",
      ],
      dataSufficient: true,
    };
  }

  const sorted = [...primaryResults].sort(
    (left, right) => (right.normalisedValue ?? right.rawValue) - (left.normalisedValue ?? left.rawValue),
  );
  const best = sorted[0];
  const control = sorted[sorted.length - 1];
  const bestValue = best.normalisedValue ?? best.rawValue;
  const controlValue = control.normalisedValue ?? control.rawValue;
  const absoluteDifference = bestValue - controlValue;
  const percentageDifference = computePercentageDifference(controlValue, bestValue);

  if (
    percentageDifference === null ||
    Math.abs(percentageDifference) < WINNER_MIN_PERCENTAGE_DIFFERENCE
  ) {
    return {
      outcome: "INCONCLUSIVE",
      winningVariantId: null,
      losingVariantId: null,
      absoluteDifference,
      percentageDifference,
      limitations: [
        ...limitations,
        `Difference below the ${WINNER_MIN_PERCENTAGE_DIFFERENCE}% threshold required to declare a winner.`,
      ],
      dataSufficient: true,
    };
  }

  return {
    outcome: "WINNER",
    winningVariantId: best.variantId,
    losingVariantId: control.variantId,
    absoluteDifference,
    percentageDifference,
    limitations,
    dataSufficient: true,
  };
}
