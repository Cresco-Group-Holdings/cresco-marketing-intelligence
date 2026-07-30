import {
  DELIVERY_IMBALANCE_RATIO,
  STALE_DATA_HOURS,
  VALIDITY_CHECK_TYPES,
} from "./constants";

export type ValidityCheck = {
  checkType: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  metadata?: Record<string, unknown>;
};

export type ValidityInput = {
  minimumVolume: number;
  allocationType: string;
  variantSampleSizes: Record<string, number>;
  variantDelivered: Record<string, boolean>;
  hasStaleObservations: boolean;
  campaignChangedDuringTest: boolean;
  audienceOverlapDetected: boolean;
  trackingFailure: boolean;
  inconsistentAttribution: boolean;
  missingConversionData: boolean;
  majorBudgetChange: boolean;
  earlyStoppingRisk: boolean;
  testDurationDays: number;
  plannedDurationDays: number;
};

export function assessAdvertisingExperimentValidity(input: ValidityInput): ValidityCheck[] {
  const checks: ValidityCheck[] = [];

  checks.push({
    checkType: VALIDITY_CHECK_TYPES.NO_RANDOMISATION,
    severity: "INFO",
    message:
      "Advertising platforms may not guarantee random audience assignment. Treat results as observational unless provider-native randomisation is confirmed.",
  });

  if (input.allocationType === "PROVIDER_NATIVE") {
    checks.push({
      checkType: VALIDITY_CHECK_TYPES.NO_RANDOMISATION,
      severity: "INFO",
      message: "Provider-native allocation — platform controls delivery split.",
    });
  }

  const sizes = Object.values(input.variantSampleSizes);
  if (sizes.some((s) => s < input.minimumVolume)) {
    checks.push({
      checkType: VALIDITY_CHECK_TYPES.INSUFFICIENT_VOLUME,
      severity: "CRITICAL",
      message: "At least one variant is below the minimum volume threshold.",
    });
  }

  if (sizes.length >= 2) {
    const max = Math.max(...sizes);
    const min = Math.min(...sizes.filter((s) => s > 0));
    if (min > 0 && max / min >= DELIVERY_IMBALANCE_RATIO) {
      checks.push({
        checkType: VALIDITY_CHECK_TYPES.UNEQUAL_DELIVERY,
        severity: "WARNING",
        message: `Delivery imbalance detected (ratio ${(max / min).toFixed(1)}:1).`,
      });
    }
  }

  for (const [variantId, delivered] of Object.entries(input.variantDelivered)) {
    if (!delivered) {
      checks.push({
        checkType: VALIDITY_CHECK_TYPES.VARIANT_NOT_DELIVERED,
        severity: "CRITICAL",
        message: `Variant ${variantId} has not received delivery.`,
        metadata: { variantId },
      });
    }
  }

  if (input.hasStaleObservations) {
    checks.push({
      checkType: VALIDITY_CHECK_TYPES.STALE_DATA,
      severity: "WARNING",
      message: `Observation data is older than ${STALE_DATA_HOURS} hours.`,
    });
  }

  if (input.campaignChangedDuringTest) {
    checks.push({
      checkType: VALIDITY_CHECK_TYPES.CAMPAIGN_CHANGE_DURING_TEST,
      severity: "CRITICAL",
      message: "Campaign configuration changed during the test period.",
    });
  }

  if (input.audienceOverlapDetected) {
    checks.push({
      checkType: VALIDITY_CHECK_TYPES.AUDIENCE_OVERLAP,
      severity: "CRITICAL",
      message: "Audience overlap detected between variants.",
    });
  }

  if (input.trackingFailure) {
    checks.push({
      checkType: VALIDITY_CHECK_TYPES.TRACKING_FAILURE,
      severity: "CRITICAL",
      message: "Conversion tracking failure detected.",
    });
  }

  if (input.inconsistentAttribution) {
    checks.push({
      checkType: VALIDITY_CHECK_TYPES.INCONSISTENT_ATTRIBUTION,
      severity: "WARNING",
      message: "Inconsistent attribution windows across variants.",
    });
  }

  if (input.missingConversionData) {
    checks.push({
      checkType: VALIDITY_CHECK_TYPES.MISSING_CONVERSION_DATA,
      severity: "CRITICAL",
      message: "Conversion data is missing for one or more variants.",
    });
  }

  if (input.majorBudgetChange) {
    checks.push({
      checkType: VALIDITY_CHECK_TYPES.MAJOR_BUDGET_CHANGE,
      severity: "CRITICAL",
      message: "Major budget change occurred during the test.",
    });
  }

  if (input.earlyStoppingRisk && input.testDurationDays < input.plannedDurationDays * 0.5) {
    checks.push({
      checkType: VALIDITY_CHECK_TYPES.EARLY_STOPPING_RISK,
      severity: "WARNING",
      message: "Test ended before 50% of planned duration — early stopping risk.",
    });
  }

  return checks;
}

export function hasCriticalValidityIssues(checks: ValidityCheck[]): boolean {
  return checks.some((c) => c.severity === "CRITICAL");
}
