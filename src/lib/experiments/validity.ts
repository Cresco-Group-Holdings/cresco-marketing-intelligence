import type { SocialProvider } from "@prisma/client";
import {
  AUDIENCE_IMBALANCE_RATIO,
  PUBLISH_TIME_COMPARABILITY_HOURS,
  VALIDITY_WARNING_CODES,
  type ValidityWarning,
} from "@/lib/experiments/constants";

export type VariantInput = {
  label: string;
  provider?: SocialProvider | null;
  scheduledFor?: Date | null;
  publishedAt?: Date | null;
  hasPaidPromotion?: boolean;
  contentTopic?: string | null;
  contentPillar?: string | null;
};

export type ValidityCheckInput = {
  targetProvider: string;
  minimumSampleThreshold: number;
  variants: VariantInput[];
  sampleSizes?: Record<string, number>;
};

export function assessExperimentValidity(input: ValidityCheckInput): ValidityWarning[] {
  const warnings: ValidityWarning[] = [
    {
      code: VALIDITY_WARNING_CODES.NOT_RANDOMISED_AB,
      message:
        "This platform cannot deliver randomised A/B tests to controlled equivalent audiences. Treat results as observational.",
      severity: "INFO",
    },
  ];

  const providers = new Set(
    input.variants.map((variant) => variant.provider ?? input.targetProvider).filter(Boolean),
  );
  if (providers.size > 1) {
    warnings.push({
      code: VALIDITY_WARNING_CODES.DIFFERENT_PLATFORMS,
      message: "Variants publish on different platforms, which limits comparability.",
      severity: "CRITICAL",
    });
  }

  const paidCount = input.variants.filter((variant) => variant.hasPaidPromotion).length;
  if (paidCount > 0 && paidCount < input.variants.length) {
    warnings.push({
      code: VALIDITY_WARNING_CODES.PAID_PROMOTION_BIAS,
      message: "Paid promotion affects only some variants.",
      severity: "CRITICAL",
    });
  }

  const publishTimes = input.variants
    .map((variant) => variant.publishedAt ?? variant.scheduledFor)
    .filter((value): value is Date => value instanceof Date);
  if (publishTimes.length >= 2) {
    const min = Math.min(...publishTimes.map((date) => date.getTime()));
    const max = Math.max(...publishTimes.map((date) => date.getTime()));
    const hoursApart = (max - min) / 3_600_000;
    if (hoursApart > PUBLISH_TIME_COMPARABILITY_HOURS) {
      warnings.push({
        code: VALIDITY_WARNING_CODES.INCOMPARABLE_PUBLISH_TIMES,
        message: `Publication times differ by more than ${PUBLISH_TIME_COMPARABILITY_HOURS} hours.`,
        severity: "WARNING",
      });
    }
  }

  const topics = new Set(input.variants.map((variant) => variant.contentTopic).filter(Boolean));
  if (topics.size > 1) {
    warnings.push({
      code: VALIDITY_WARNING_CODES.TOPIC_MISMATCH,
      message: "Content topics differ beyond the tested variable.",
      severity: "WARNING",
    });
  }

  const pillars = new Set(input.variants.map((variant) => variant.contentPillar).filter(Boolean));
  if (pillars.size > 1) {
    warnings.push({
      code: VALIDITY_WARNING_CODES.TOPIC_MISMATCH,
      message: "Content pillars differ beyond the tested variable.",
      severity: "WARNING",
    });
  }

  if (input.sampleSizes) {
    const sizes = Object.values(input.sampleSizes);
    if (sizes.some((size) => size < input.minimumSampleThreshold)) {
      warnings.push({
        code: VALIDITY_WARNING_CODES.INSUFFICIENT_SAMPLE,
        message: "At least one variant is below the minimum sample threshold.",
        severity: "CRITICAL",
      });
    }
    if (sizes.length >= 2) {
      const max = Math.max(...sizes);
      const min = Math.min(...sizes);
      if (min > 0 && max / min >= AUDIENCE_IMBALANCE_RATIO) {
        warnings.push({
          code: VALIDITY_WARNING_CODES.AUDIENCE_SIZE_IMBALANCE,
          message: "Audience sizes differ substantially between variants.",
          severity: "WARNING",
        });
      }
    }
    if (sizes.some((size) => size > 0 && size < 50)) {
      warnings.push({
        code: VALIDITY_WARNING_CODES.UNSTABLE_ORGANIC_REACH,
        message: "Organic reach may be unstable at this sample size.",
        severity: "WARNING",
      });
    }
  }

  return warnings;
}
