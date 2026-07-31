import { DELIVERABILITY_THRESHOLDS } from "@/lib/email/constants";

export type DeliverabilityMetrics = {
  sentCount: number;
  deliveredCount: number;
  bounceCount: number;
  hardBounceCount: number;
  complaintCount: number;
  unsubscribeCount: number;
  rejectionCount: number;
};

export type DeliverabilityWarning = {
  type: string;
  severity: "WARNING" | "CRITICAL";
  message: string;
  threshold: number;
  actual: number;
};

export function computeRates(metrics: DeliverabilityMetrics) {
  const { sentCount } = metrics;
  if (sentCount === 0) {
    return { deliveryRate: 0, bounceRate: 0, hardBounceRate: 0, complaintRate: 0, unsubscribeRate: 0 };
  }
  return {
    deliveryRate: metrics.deliveredCount / sentCount,
    bounceRate: metrics.bounceCount / sentCount,
    hardBounceRate: metrics.hardBounceCount / sentCount,
    complaintRate: metrics.complaintCount / sentCount,
    unsubscribeRate: metrics.unsubscribeCount / sentCount,
  };
}

export function detectDeliverabilityWarnings(metrics: DeliverabilityMetrics): DeliverabilityWarning[] {
  const rates = computeRates(metrics);
  const warnings: DeliverabilityWarning[] = [];

  if (rates.bounceRate >= DELIVERABILITY_THRESHOLDS.bounceRateShutdown) {
    warnings.push({ type: "bounce_rate", severity: "CRITICAL", message: "Bounce rate exceeds shutdown threshold.", threshold: DELIVERABILITY_THRESHOLDS.bounceRateShutdown, actual: rates.bounceRate });
  } else if (rates.bounceRate >= DELIVERABILITY_THRESHOLDS.bounceRateWarning) {
    warnings.push({ type: "bounce_rate", severity: "WARNING", message: "Bounce rate elevated.", threshold: DELIVERABILITY_THRESHOLDS.bounceRateWarning, actual: rates.bounceRate });
  }

  if (rates.complaintRate >= DELIVERABILITY_THRESHOLDS.complaintRateShutdown) {
    warnings.push({ type: "complaint_rate", severity: "CRITICAL", message: "Complaint rate exceeds shutdown threshold — sending should pause.", threshold: DELIVERABILITY_THRESHOLDS.complaintRateShutdown, actual: rates.complaintRate });
  } else if (rates.complaintRate >= DELIVERABILITY_THRESHOLDS.complaintRateWarning) {
    warnings.push({ type: "complaint_rate", severity: "WARNING", message: "Complaint rate elevated.", threshold: DELIVERABILITY_THRESHOLDS.complaintRateWarning, actual: rates.complaintRate });
  }

  if (rates.unsubscribeRate >= DELIVERABILITY_THRESHOLDS.unsubscribeRateWarning) {
    warnings.push({ type: "unsubscribe_rate", severity: "WARNING", message: "Unsubscribe rate elevated.", threshold: DELIVERABILITY_THRESHOLDS.unsubscribeRateWarning, actual: rates.unsubscribeRate });
  }

  return warnings;
}

export function shouldShutdownSending(warnings: DeliverabilityWarning[]): boolean {
  return warnings.some((w) => w.severity === "CRITICAL");
}
