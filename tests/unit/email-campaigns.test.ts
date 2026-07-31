import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { generateCampaignDraft } from "@/lib/email-campaigns/ai-assistant";
import { computeAudienceBreakdown, hashContent, hashAudienceRules } from "@/lib/email-campaigns/audience";
import { isApprovalValid } from "@/lib/email-campaigns/approval";
import { computeCampaignRates } from "@/lib/email-campaigns/analytics";
import { allocateVariant, evaluateExperiment } from "@/lib/email-campaigns/experiments";
import { allChecksPassed, runReadinessChecks } from "@/lib/email-campaigns/readiness";
import { canCancelSchedule, canEmergencyStop, isScheduleDue, resolveStatusAfterSend } from "@/lib/email-campaigns/scheduling";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

describe("audience breakdown", () => {
  it("filters suppressed and invalid recipients", () => {
    const result = computeAudienceBreakdown(
      [
        { emailAddress: "a@b.com", consentMarketing: true },
        { emailAddress: "a@b.com", consentMarketing: true },
        { emailAddress: "bad", consentMarketing: true },
        { emailAddress: "c@d.com", consentMarketing: false },
      ],
      new Set(["a@b.com"]),
    );
    expect(result.duplicatedCount).toBe(1);
    expect(result.invalidCount).toBe(1);
    expect(result.suppressedCount).toBe(1);
    expect(result.finalSendableCount).toBe(0);
  });

  it("produces stable audience hash", () => {
    expect(hashAudienceRules({ status: "QUALIFIED" })).toHaveLength(64);
  });
});

describe("content approval hash", () => {
  it("changes when content changes", () => {
    const h1 = hashContent({ subject: "Hello" });
    const h2 = hashContent({ subject: "Hello!" });
    expect(h1).not.toBe(h2);
  });
});

describe("approval binding", () => {
  it("invalidates stale content hash", () => {
    const result = isApprovalValid(
      { status: "APPROVED", approvalType: "CONTENT", contentHash: "abc" },
      { contentHash: "def", recipientCount: 100 },
    );
    expect(result.valid).toBe(false);
  });

  it("accepts matching approval", () => {
    const result = isApprovalValid(
      { status: "APPROVED", approvalType: "CONTENT", contentHash: "abc", recipientCountMin: 95, recipientCountMax: 105 },
      { contentHash: "abc", recipientCount: 100 },
    );
    expect(result.valid).toBe(true);
  });
});

describe("readiness checks", () => {
  it("fails without unsubscribe link", () => {
    const results = runReadinessChecks({
      domainReady: true, senderVerified: true, templateApproved: true,
      audienceSendableCount: 10, consentEligible: true, suppressionClear: true,
      hasUnsubscribeLink: false, hasLegalSenderDetails: true, scheduleValid: true,
      testSendCompleted: true, withinQuota: true, deliverabilityShutdown: false, allApprovalsGranted: true,
    });
    expect(allChecksPassed(results)).toBe(false);
  });
});

describe("scheduling", () => {
  it("detects due schedule", () => {
    expect(isScheduleDue(new Date(Date.now() - 1000), false)).toBe(true);
    expect(isScheduleDue(new Date(Date.now() + 86_400_000), false)).toBe(false);
  });

  it("allows cancel on scheduled", () => {
    expect(canCancelSchedule("SCHEDULED")).toBe(true);
    expect(canCancelSchedule("SENT")).toBe(false);
  });

  it("supports emergency stop while sending", () => {
    expect(canEmergencyStop("SENDING")).toBe(true);
  });

  it("resolves partial send status", () => {
    expect(resolveStatusAfterSend(100, 80, 20)).toBe("PARTIALLY_SENT");
  });
});

describe("A/B experiments", () => {
  it("allocates variants deterministically", () => {
    expect(allocateVariant(0, 100, 50)).toBe("A");
    expect(allocateVariant(60, 100, 50)).toBe("B");
  });

  it("does not pick winner with insufficient sample", () => {
    const result = evaluateExperiment(
      { sampleSize: 10, opens: 5, clicks: 2, conversions: 0 },
      { sampleSize: 10, opens: 3, clicks: 1, conversions: 0 },
      { sampleAllocationPercent: 50, primaryMetric: "click_rate", minimumSample: 100 },
    );
    expect(result.winnerVariant).toBeNull();
    expect(result.status).toBe("INSUFFICIENT_EVIDENCE");
  });
});

describe("AI campaign assistant", () => {
  it("requires objective or instructions", () => {
    expect(generateCampaignDraft({})).toBeNull();
  });

  it("does not invent testimonials", () => {
    const draft = generateCampaignDraft({ campaignObjective: "Newsletter", product: "Cresco" });
    expect(draft?.provenance.inventedTestimonials).toBe(false);
    expect(draft?.requiresHumanApproval).toBe(true);
  });
});

describe("campaign analytics", () => {
  it("computes rates from metrics", () => {
    const rates = computeCampaignRates({ attempted: 100, sent: 100, delivered: 90, bounced: 5, complained: 1, unsubscribed: 2, opened: 40, clicked: 10, ctaClicks: 5, conversions: 2 });
    expect(rates.deliveryRate).toBe(0.9);
    expect(rates.clickRate).toBe(0.1);
  });
});

describe("campaign permissions", () => {
  it("grants marketers send access", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["emailCampaigns.send"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["emailCampaigns.approve"])).toBe(false);
  });

  it("limits viewers to read and analytics", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["emailCampaigns.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["emailCampaigns.send"])).toBe(false);
  });
});
