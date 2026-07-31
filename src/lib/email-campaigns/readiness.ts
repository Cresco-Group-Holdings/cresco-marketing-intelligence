import type { EmailCampaignReadinessCheckType } from "@prisma/client";
import { MIN_RECIPIENT_COUNT_FOR_SEND } from "@/lib/email-campaigns/constants";

export type ReadinessContext = {
  domainReady: boolean;
  senderVerified: boolean;
  templateApproved: boolean;
  audienceSendableCount: number;
  consentEligible: boolean;
  suppressionClear: boolean;
  hasUnsubscribeLink: boolean;
  hasLegalSenderDetails: boolean;
  scheduleValid: boolean;
  testSendCompleted: boolean;
  withinQuota: boolean;
  deliverabilityShutdown: boolean;
  allApprovalsGranted: boolean;
};

export type ReadinessResult = {
  checkType: EmailCampaignReadinessCheckType;
  passed: boolean;
  message?: string;
};

export function runReadinessChecks(ctx: ReadinessContext): ReadinessResult[] {
  return [
    { checkType: "SENDING_DOMAIN", passed: ctx.domainReady, message: ctx.domainReady ? undefined : "Sending domain is not ready." },
    { checkType: "VERIFIED_SENDER", passed: ctx.senderVerified, message: ctx.senderVerified ? undefined : "Sender identity is not verified." },
    { checkType: "TEMPLATE_APPROVAL", passed: ctx.templateApproved, message: ctx.templateApproved ? undefined : "Template is not approved." },
    { checkType: "AUDIENCE_ELIGIBILITY", passed: ctx.audienceSendableCount >= MIN_RECIPIENT_COUNT_FOR_SEND, message: "No sendable recipients." },
    { checkType: "CONSENT", passed: ctx.consentEligible, message: ctx.consentEligible ? undefined : "Audience consent requirements not met." },
    { checkType: "SUPPRESSION", passed: ctx.suppressionClear, message: ctx.suppressionClear ? undefined : "Suppression check failed." },
    { checkType: "UNSUBSCRIBE_LINK", passed: ctx.hasUnsubscribeLink, message: ctx.hasUnsubscribeLink ? undefined : "Unsubscribe link is required." },
    { checkType: "LEGAL_SENDER_DETAILS", passed: ctx.hasLegalSenderDetails, message: ctx.hasLegalSenderDetails ? undefined : "Legal sender details required." },
    { checkType: "SCHEDULE", passed: ctx.scheduleValid, message: ctx.scheduleValid ? undefined : "Schedule is invalid." },
    { checkType: "TEST_SEND", passed: ctx.testSendCompleted, message: ctx.testSendCompleted ? undefined : "Test send not completed." },
    { checkType: "RECIPIENT_COUNT", passed: ctx.audienceSendableCount >= MIN_RECIPIENT_COUNT_FOR_SEND, message: "Recipient count below minimum." },
    { checkType: "TENANT_QUOTA", passed: ctx.withinQuota, message: ctx.withinQuota ? undefined : "Tenant quota exceeded." },
    { checkType: "DELIVERABILITY_SHUTDOWN", passed: !ctx.deliverabilityShutdown, message: ctx.deliverabilityShutdown ? "Deliverability shutdown active." : undefined },
    { checkType: "REQUIRED_APPROVAL", passed: ctx.allApprovalsGranted, message: ctx.allApprovalsGranted ? undefined : "Required approvals not granted." },
  ];
}

export function allChecksPassed(results: ReadinessResult[]): boolean {
  return results.every((r) => r.passed);
}
