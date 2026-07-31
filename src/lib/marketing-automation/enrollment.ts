import { createHash } from "crypto";
import { REPEAT_POLICIES, type RepeatPolicy } from "./constants";
import type { LeadSnapshot } from "./conditions";

export type EnrollmentEligibilityInput = {
  snapshot: LeadSnapshot;
  consentMarketing: boolean;
  suppressed: boolean;
  unsubscribed: boolean;
  automationActive: boolean;
};

export type PriorEnrollment = {
  automationId: string;
  leadId: string;
  status: "ACTIVE" | "COMPLETED" | "EXITED";
  enrolledAt: Date;
  exitedAt?: Date | null;
  completedAt?: Date | null;
};

export function checkConsentEligibility(
  consentMarketing: boolean,
): { eligible: boolean; reason?: string } {
  if (!consentMarketing) {
    return { eligible: false, reason: "Marketing consent not granted." };
  }
  return { eligible: true };
}

export function checkSuppressionEligibility(
  suppressed: boolean,
  unsubscribed: boolean,
): { eligible: boolean; reason?: string } {
  if (suppressed) {
    return { eligible: false, reason: "Lead is on the suppression list." };
  }
  if (unsubscribed) {
    return { eligible: false, reason: "Lead has unsubscribed from marketing email." };
  }
  return { eligible: true };
}

export function checkEnrollmentEligibility(
  input: EnrollmentEligibilityInput,
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!input.automationActive) {
    reasons.push("Automation is not active.");
  }

  const consent = checkConsentEligibility(input.consentMarketing);
  if (!consent.eligible && consent.reason) reasons.push(consent.reason);

  const suppression = checkSuppressionEligibility(input.suppressed, input.unsubscribed);
  if (!suppression.eligible && suppression.reason) reasons.push(suppression.reason);

  return { eligible: reasons.length === 0, reasons };
}

export function buildEnrollmentDedupeKey(
  automationId: string,
  leadId: string,
  triggerEventId?: string,
): string {
  const seed = triggerEventId
    ? `${automationId}:${leadId}:${triggerEventId}`
    : `${automationId}:${leadId}`;
  return createHash("sha256").update(seed).digest("hex");
}

export function isValidRepeatPolicy(value: string): value is RepeatPolicy {
  return (REPEAT_POLICIES as readonly string[]).includes(value);
}

export function checkRepeatPolicy(
  policy: RepeatPolicy,
  automationId: string,
  leadId: string,
  priorEnrollments: PriorEnrollment[],
): { allowed: boolean; reason?: string } {
  const relevant = priorEnrollments.filter(
    (enrollment) => enrollment.automationId === automationId && enrollment.leadId === leadId,
  );

  switch (policy) {
    case "ONE_TIME":
      if (relevant.length > 0) {
        return { allowed: false, reason: "Lead has already been enrolled in this automation." };
      }
      return { allowed: true };
    case "ALLOW_REPEAT":
      if (relevant.some((enrollment) => enrollment.status === "ACTIVE")) {
        return { allowed: false, reason: "Lead is already actively enrolled." };
      }
      return { allowed: true };
    case "ALLOW_AFTER_COMPLETION":
      if (relevant.some((enrollment) => enrollment.status === "ACTIVE")) {
        return { allowed: false, reason: "Lead is already actively enrolled." };
      }
      if (relevant.some((enrollment) => enrollment.status === "COMPLETED")) {
        return { allowed: false, reason: "Lead already completed this automation." };
      }
      return { allowed: true };
    default:
      return { allowed: false, reason: "Unknown repeat policy." };
  }
}
