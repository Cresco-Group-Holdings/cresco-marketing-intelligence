import { createHash } from "node:crypto";
import type { FunnelStepDefinition, FunnelSubjectEvent, FunnelStepMatchingRules } from "@/lib/funnel/types";

export function matchesStep(event: FunnelSubjectEvent, step: FunnelStepDefinition): boolean {
  const rules = step.matchingRules as FunnelStepMatchingRules;

  switch (step.stepType) {
    case "EVENT":
      return rules.eventName ? event.eventName === rules.eventName : false;
    case "CONVERSION":
      return rules.conversionKey ? event.eventName === rules.conversionKey : false;
    case "PAGE":
      if (rules.eventName) return event.eventName === rules.eventName;
      if (rules.pagePath) return event.pagePath === rules.pagePath;
      if (rules.pagePathContains) return event.pagePath?.includes(rules.pagePathContains) ?? false;
      return event.eventName === "page_view";
    case "CAMPAIGN":
      if (rules.campaignId) return event.campaign === rules.campaignId;
      if (rules.campaignName) return event.campaign === rules.campaignName;
      return false;
    case "LEAD_STATUS":
      return rules.leadStatus ? event.leadStatus === rules.leadStatus : false;
    case "CRM_STAGE":
      return rules.crmStage ? event.crmStage === rules.crmStage : false;
    case "SUBSCRIPTION_STATUS":
      return rules.subscriptionStatus ? event.subscriptionStatus === rules.subscriptionStatus : false;
    case "PAYMENT_STATUS":
      return rules.paymentStatus ? event.paymentStatus === rules.paymentStatus : false;
    default:
      return false;
  }
}

export function buildSubjectKey(
  event: FunnelSubjectEvent,
  countingMethod: "USER" | "SESSION" | "EVENT",
): string {
  if (countingMethod === "USER") {
    return event.identityId ?? event.subjectKey;
  }
  if (countingMethod === "SESSION") {
    return event.sessionId ?? event.subjectKey;
  }
  return `${event.subjectKey}:${event.occurredAt.getTime()}:${event.eventName ?? "event"}`;
}

export function anonymiseSubjectId(subjectKey: string): string {
  return `anon_${createHash("sha256").update(subjectKey).digest("hex").slice(0, 12)}`;
}
