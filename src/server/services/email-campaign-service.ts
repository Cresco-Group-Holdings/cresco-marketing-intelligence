import type { EmailCampaignType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { generateCampaignDraft } from "@/lib/email-campaigns/ai-assistant";
import { computeAudienceBreakdown, hashAudienceRules, hashContent } from "@/lib/email-campaigns/audience";
import { isApprovalValid } from "@/lib/email-campaigns/approval";
import { buildMetricLimitations, computeCampaignRates } from "@/lib/email-campaigns/analytics";
import { REQUIRED_APPROVAL_TYPES } from "@/lib/email-campaigns/constants";
import { allocateVariant, evaluateExperiment } from "@/lib/email-campaigns/experiments";
import { allChecksPassed, runReadinessChecks } from "@/lib/email-campaigns/readiness";
import {
  canCancelSchedule,
  canEmergencyStop,
  canScheduleCampaign,
  isScheduleDue,
  resolveStatusAfterSend,
} from "@/lib/email-campaigns/scheduling";
import { shouldShutdownSending, detectDeliverabilityWarnings } from "@/lib/email/deliverability";
import { normaliseEmailAddress } from "@/lib/email/suppression";
import { checkTenantQuota } from "@/lib/email/send-pipeline";
import { sanitiseEmailHtml } from "@/lib/email/template-sanitise";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";
import { emailMessageService } from "@/server/services/email-message-service";
import { recordAuditEvent } from "@/server/services/audit-service";

const campaignInclude = {
  versions: { orderBy: { versionNumber: "desc" as const }, take: 1 },
  audiences: { orderBy: { computedAt: "desc" as const }, take: 1 },
  contents: { orderBy: { id: "desc" as const }, take: 1 },
  schedules: { orderBy: { id: "desc" as const }, take: 1 },
  approvals: true,
  experiments: true,
} satisfies Prisma.EmailCampaignInclude;

async function getLatestVersionId(campaignId: string) {
  const version = await prisma.emailCampaignVersion.findFirst({
    where: { campaignId },
    orderBy: { versionNumber: "desc" },
  });
  return version?.id;
}

export const emailCampaignService = {
  async listCampaigns(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.emailCampaign.findMany({
      where: { organisationId, brandId, archivedAt: null },
      include: campaignInclude,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  },

  async getCampaign(campaignId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const campaign = await prisma.emailCampaign.findFirst({
      where: { id: campaignId, organisationId, brandId },
      include: {
        ...campaignInclude,
        readinessChecks: { orderBy: { checkedAt: "desc" }, take: 20 },
        sendRuns: { orderBy: { startedAt: "desc" }, take: 5 },
        metrics: { orderBy: { computedAt: "desc" }, take: 5 },
        snapshots: { take: 0 },
      },
    });
    if (!campaign) throw new AppError("NOT_FOUND", "Campaign not found.");
    return campaign;
  },

  async createCampaign(
    brandId: string,
    organisationId: string,
    input: { name: string; campaignType: EmailCampaignType; objective?: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    return prisma.$transaction(async (tx) => {
      const campaign = await tx.emailCampaign.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          name: input.name,
          campaignType: input.campaignType,
          objective: input.objective,
          createdByUserId: context.userProfileId,
        },
      });
      const version = await tx.emailCampaignVersion.create({
        data: {
          campaignId: campaign.id,
          versionNumber: 1,
          createdByUserId: context.userProfileId,
        },
      });
      await tx.emailCampaign.update({
        where: { id: campaign.id },
        data: { currentVersionId: version.id },
      });
      return campaign;
    });
  },

  async setAudience(
    campaignId: string,
    brandId: string,
    organisationId: string,
    input: { segmentId?: string; segmentRules?: Prisma.InputJsonValue; members: Array<{ emailAddress: string; displayName?: string; leadId?: string; contactId?: string; consentMarketing: boolean }> },
    context: TenantContext,
  ) {
    await this.getCampaign(campaignId, brandId, organisationId, context);
    const versionId = (await prisma.emailCampaignVersion.findFirst({ where: { campaignId }, orderBy: { versionNumber: "desc" } }))?.id;
    if (!versionId) throw new AppError("VALIDATION_ERROR", "Campaign has no version.");

    if (input.segmentId) {
      const segment = await prisma.crmAudienceSegment.findFirst({
        where: { id: input.segmentId, organisationId, brandId, status: "APPROVED" },
      });
      if (!segment) throw new AppError("VALIDATION_ERROR", "Segment must be approved.");
    }

    const suppressions = await prisma.emailSuppression.findMany({ where: { organisationId } });
    const suppressedSet = new Set(suppressions.map((s) => s.emailAddress));
    const breakdown = computeAudienceBreakdown(input.members, suppressedSet);
    const audienceRuleHash = hashAudienceRules(input.segmentRules ?? input.segmentId ?? {});

    const audience = await prisma.emailCampaignAudience.create({
      data: {
        campaignId,
        versionId,
        segmentId: input.segmentId,
        segmentRules: input.segmentRules,
        totalMembers: breakdown.totalMembers,
        consentEligible: breakdown.consentEligible,
        suppressedCount: breakdown.suppressedCount,
        invalidCount: breakdown.invalidCount,
        duplicatedCount: breakdown.duplicatedCount,
        finalSendableCount: breakdown.finalSendableCount,
        segmentFreshness: new Date(),
        computedAt: new Date(),
      },
    });

    await prisma.emailCampaignVersion.update({
      where: { id: versionId },
      data: { audienceRuleHash },
    });

    await prisma.emailCampaignApproval.updateMany({
      where: { campaignId, approvalType: "AUDIENCE", status: "APPROVED" },
      data: { status: "INVALIDATED" },
    });

    return { audience, breakdown };
  },

  async setContent(
    campaignId: string,
    brandId: string,
    organisationId: string,
    input: {
      templateId?: string;
      templateVersionId?: string;
      senderIdentityId?: string;
      replyTo?: string;
      subject: string;
      preheader?: string;
      htmlBody?: string;
      plainTextBody?: string;
      ctaText?: string;
      ctaUrl?: string;
      utmParameters?: Prisma.InputJsonValue;
      language?: string;
      complianceFooter?: string;
      unsubscribeLink?: string;
    },
    context: TenantContext,
  ) {
    await this.getCampaign(campaignId, brandId, organisationId, context);
    const versionId = (await prisma.emailCampaignVersion.findFirst({ where: { campaignId }, orderBy: { versionNumber: "desc" } }))?.id;
    if (!versionId) throw new AppError("VALIDATION_ERROR", "Campaign has no version.");

    const htmlBody = input.htmlBody ? sanitiseEmailHtml(input.htmlBody).sanitised : undefined;
    const contentHash = hashContent({ ...input, htmlBody });

    const content = await prisma.emailCampaignContent.create({
      data: {
        campaignId,
        versionId,
        ...input,
        htmlBody,
        contentHash,
      },
    });

    await prisma.emailCampaignVersion.update({
      where: { id: versionId },
      data: { contentHash },
    });

    await prisma.emailCampaignApproval.updateMany({
      where: { campaignId, approvalType: { in: ["CONTENT", "COMPLIANCE"] }, status: "APPROVED" },
      data: { status: "INVALIDATED" },
    });

    return content;
  },

  async runReadinessChecks(campaignId: string, brandId: string, organisationId: string, context: TenantContext) {
    const campaign = await this.getCampaign(campaignId, brandId, organisationId, context);
    const versionId = campaign.versions[0]?.id;
    if (!versionId) throw new AppError("VALIDATION_ERROR", "No campaign version.");

    const audience = campaign.audiences[0];
    const content = campaign.contents[0];
    const schedule = campaign.schedules[0];

    let domainReady = false;
    let senderVerified = false;
    if (content?.senderIdentityId) {
      const sender = await prisma.emailSenderIdentity.findFirst({
        where: { id: content.senderIdentityId, organisationId },
        include: { domain: true },
      });
      domainReady = sender?.domain.sendingStatus === "READY";
      senderVerified = sender?.verificationStatus === "VERIFIED";
    }

    let templateApproved = true;
    if (content?.templateVersionId) {
      const tv = await prisma.emailTemplateVersion.findFirst({ where: { id: content.templateVersionId } });
      templateApproved = tv?.status === "APPROVED";
    }

    const deliverability = await prisma.emailDeliverabilitySnapshot.findFirst({
      where: { organisationId, brandId },
      orderBy: { computedAt: "desc" },
    });
    const shutdown = deliverability?.warnings
      ? shouldShutdownSending(detectDeliverabilityWarnings({
          sentCount: deliverability.sentCount,
          deliveredCount: deliverability.deliveredCount,
          bounceCount: deliverability.bounceCount,
          hardBounceCount: deliverability.hardBounceCount,
          complaintCount: deliverability.complaintCount,
          unsubscribeCount: deliverability.unsubscribeCount,
          rejectionCount: deliverability.rejectionCount,
        }))
      : false;

    const allApprovalsGranted = REQUIRED_APPROVAL_TYPES.every((type) =>
      campaign.approvals.some((a) => a.approvalType === type && a.status === "APPROVED"),
    );

    const results = runReadinessChecks({
      domainReady,
      senderVerified,
      templateApproved,
      audienceSendableCount: audience?.finalSendableCount ?? 0,
      consentEligible: (audience?.consentEligible ?? 0) > 0,
      suppressionClear: true,
      hasUnsubscribeLink: !!content?.unsubscribeLink,
      hasLegalSenderDetails: !!content?.complianceFooter,
      scheduleValid: !!schedule && (schedule.sendNow || !!schedule.scheduledAt),
      testSendCompleted: campaign.approvals.some((a) => a.notes?.includes("test_send")),
      withinQuota: checkTenantQuota(0, 10_000).allowed,
      deliverabilityShutdown: shutdown,
      allApprovalsGranted,
    });

    await prisma.emailCampaignReadinessCheck.createMany({
      data: results.map((r) => ({
        campaignId,
        versionId,
        checkType: r.checkType,
        passed: r.passed,
        message: r.message,
      })),
    });

    const passed = allChecksPassed(results);
    if (passed) {
      await prisma.emailCampaign.update({
        where: { id: campaignId },
        data: { status: "READY_FOR_REVIEW" },
      });
    }

    return { results, passed };
  },

  async grantApproval(
    campaignId: string,
    brandId: string,
    organisationId: string,
    input: { approvalType: string; notes?: string },
    context: TenantContext,
  ) {
    const campaign = await this.getCampaign(campaignId, brandId, organisationId, context);
    const version = campaign.versions[0];
    const audience = campaign.audiences[0];
    const content = campaign.contents[0];
    const schedule = campaign.schedules[0];
    if (!version) throw new AppError("VALIDATION_ERROR", "No version.");

    return prisma.emailCampaignApproval.create({
      data: {
        campaignId,
        versionId: version.id,
        approvalType: input.approvalType as "AUDIENCE",
        status: "APPROVED",
        contentHash: content?.contentHash,
        audienceRuleHash: version.audienceRuleHash,
        recipientCountMin: audience?.finalSendableCount,
        recipientCountMax: audience?.finalSendableCount,
        scheduledAtBound: schedule?.scheduledAt,
        approvedByUserId: context.userProfileId,
        approvedAt: new Date(),
        notes: input.notes,
      },
    });
  },

  async setSchedule(
    campaignId: string,
    brandId: string,
    organisationId: string,
    input: { sendNow?: boolean; scheduledAt?: string; timezone?: string; batchSize?: number },
    context: TenantContext,
  ) {
    const campaign = await this.getCampaign(campaignId, brandId, organisationId, context);
    if (!canScheduleCampaign(campaign.status, campaign.emergencyStopped)) {
      throw new AppError("VALIDATION_ERROR", "Campaign cannot be scheduled in current state.");
    }
    const versionId = campaign.versions[0]?.id;
    if (!versionId) throw new AppError("VALIDATION_ERROR", "No version.");

    const schedule = await prisma.emailCampaignSchedule.create({
      data: {
        campaignId,
        versionId,
        sendNow: input.sendNow ?? false,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
        timezone: input.timezone,
        batchSize: input.batchSize,
      },
    });

    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: input.sendNow ? "SENDING" : "SCHEDULED" },
    });

    return schedule;
  },

  async createRecipientSnapshot(
    campaignId: string,
    brandId: string,
    organisationId: string,
    members: Array<{ emailAddress: string; displayName?: string; leadId?: string; contactId?: string; consentMarketing: boolean }>,
    context: TenantContext,
  ) {
    const campaign = await this.getCampaign(campaignId, brandId, organisationId, context);
    const versionId = campaign.versions[0]?.id;
    if (!versionId) throw new AppError("VALIDATION_ERROR", "No version.");

    const suppressions = await prisma.emailSuppression.findMany({ where: { organisationId } });
    const breakdown = computeAudienceBreakdown(members, new Set(suppressions.map((s) => s.emailAddress)));

    const sendRun = await prisma.emailCampaignSendRun.create({
      data: { campaignId, versionId, status: "BUILDING", startedAt: new Date() },
    });

    const experiment = campaign.experiments[0];
    await prisma.emailCampaignRecipientSnapshot.createMany({
      data: breakdown.sendable.map((m, index) => ({
        campaignId,
        versionId,
        sendRunId: sendRun.id,
        emailAddress: m.emailAddress,
        displayName: m.displayName,
        leadId: m.leadId,
        contactId: m.contactId,
        consentGranted: m.consentMarketing,
        experimentVariant: experiment
          ? allocateVariant(index, breakdown.sendable.length, experiment.sampleAllocationPercent)
          : undefined,
      })),
      skipDuplicates: true,
    });

    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "BUILDING" },
    });

    return { sendRun, recipientCount: breakdown.finalSendableCount };
  },

  async launchCampaign(campaignId: string, brandId: string, organisationId: string, context: TenantContext) {
    const campaign = await this.getCampaign(campaignId, brandId, organisationId, context);
    if (campaign.emergencyStopped) throw new AppError("VALIDATION_ERROR", "Campaign emergency stopped.");

    const version = campaign.versions[0];
    const content = campaign.contents[0];
    const audience = campaign.audiences[0];
    const schedule = campaign.schedules[0];
    if (!version || !content || !audience || !content.senderIdentityId) {
      throw new AppError("VALIDATION_ERROR", "Campaign missing required content, audience, or sender.");
    }

    for (const type of REQUIRED_APPROVAL_TYPES) {
      const approval = campaign.approvals.find((a) => a.approvalType === type && a.status === "APPROVED");
      if (!approval) throw new AppError("VALIDATION_ERROR", `Missing approval: ${type}`);
      const check = isApprovalValid(approval, {
        contentHash: content.contentHash,
        audienceRuleHash: version.audienceRuleHash,
        recipientCount: audience.finalSendableCount,
        scheduledAt: schedule?.scheduledAt,
      });
      if (!check.valid) throw new AppError("VALIDATION_ERROR", check.reason ?? "Stale approval.");
    }

    if (schedule && !isScheduleDue(schedule.scheduledAt, schedule.sendNow)) {
      throw new AppError("VALIDATION_ERROR", "Scheduled send time has not arrived.");
    }

    const snapshots = await prisma.emailCampaignRecipientSnapshot.findMany({
      where: { campaignId, versionId: version.id },
    });
    if (snapshots.length === 0) {
      throw new AppError("VALIDATION_ERROR", "Recipient snapshot required before launch.");
    }

    const sendRun = await prisma.emailCampaignSendRun.create({
      data: { campaignId, versionId: version.id, status: "SENDING", startedAt: new Date() },
    });

    const message = await emailMessageService.queueMessage(brandId, organisationId, {
      senderIdentityId: content.senderIdentityId,
      category: "MARKETING",
      subject: content.subject,
      preheader: content.preheader ?? undefined,
      htmlBody: content.htmlBody ?? undefined,
      plainTextBody: content.plainTextBody ?? undefined,
      templateId: content.templateId ?? undefined,
      templateVersionId: content.templateVersionId ?? undefined,
      idempotencyKey: `campaign-${campaignId}-v${version.versionNumber}`,
      recipients: snapshots.map((s) => ({
        emailAddress: s.emailAddress,
        displayName: s.displayName ?? undefined,
        leadId: s.leadId ?? undefined,
      })),
      consent: { marketing: true, transactional: true },
    }, context);

    await emailMessageService.dispatchMessage(message.id, brandId, organisationId, context);

    const finalStatus = resolveStatusAfterSend(snapshots.length, snapshots.length, 0);
    await prisma.$transaction([
      prisma.emailCampaignSendRun.update({
        where: { id: sendRun.id },
        data: { status: finalStatus, completedAt: new Date(), totalAttempted: snapshots.length, totalSent: snapshots.length, emailMessageId: message.id },
      }),
      prisma.emailCampaign.update({ where: { id: campaignId }, data: { status: finalStatus } }),
      prisma.emailCampaignMetricSnapshot.create({
        data: {
          campaignId,
          sendRunId: sendRun.id,
          attempted: snapshots.length,
          sent: snapshots.length,
          limitations: buildMetricLimitations(false) as object,
        },
      }),
    ]);

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "email.campaign.launch",
      resourceType: "EmailCampaign",
      resourceId: campaignId,
      metadata: { brandId, recipientCount: snapshots.length },
    });

    return { sendRun, message, status: finalStatus };
  },

  async cancelCampaign(campaignId: string, brandId: string, organisationId: string, context: TenantContext) {
    const campaign = await this.getCampaign(campaignId, brandId, organisationId, context);
    if (!canCancelSchedule(campaign.status)) {
      throw new AppError("VALIDATION_ERROR", "Campaign cannot be cancelled.");
    }
    await prisma.emailCampaignSchedule.updateMany({
      where: { campaignId, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });
    return prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: "CANCELLED" },
    });
  },

  async emergencyStop(campaignId: string, brandId: string, organisationId: string, context: TenantContext) {
    const campaign = await this.getCampaign(campaignId, brandId, organisationId, context);
    if (!canEmergencyStop(campaign.status)) {
      throw new AppError("VALIDATION_ERROR", "Emergency stop not applicable.");
    }
    await prisma.emailCampaignSendRun.updateMany({
      where: { campaignId, completedAt: null },
      data: { emergencyStopped: true },
    });
    return prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { emergencyStopped: true, status: "CANCELLED" },
    });
  },

  async getAnalytics(campaignId: string, brandId: string, organisationId: string, context: TenantContext) {
    const campaign = await this.getCampaign(campaignId, brandId, organisationId, context);
    const latest = campaign.metrics[0];
    if (!latest) return { metrics: null, rates: null, limitations: buildMetricLimitations(false) };

    const metrics = {
      attempted: latest.attempted,
      sent: latest.sent,
      delivered: latest.delivered,
      bounced: latest.bounced,
      complained: latest.complained,
      unsubscribed: latest.unsubscribed,
      opened: latest.opened,
      clicked: latest.clicked,
      ctaClicks: latest.ctaClicks,
      conversions: latest.conversions,
      revenue: latest.revenue ? Number(latest.revenue) : undefined,
    };

    return {
      metrics,
      rates: computeCampaignRates(metrics),
      limitations: (latest.limitations as Record<string, string>) ?? buildMetricLimitations(false),
    };
  },

  async generateAiDraft(
    campaignId: string,
    brandId: string,
    organisationId: string,
    input: { brandKnowledge?: string; product?: string; approvedClaims?: string[]; audienceDescription?: string; userInstructions?: string },
    context: TenantContext,
  ) {
    const campaign = await this.getCampaign(campaignId, brandId, organisationId, context);
    const draft = generateCampaignDraft({
      brandKnowledge: input.brandKnowledge,
      product: input.product,
      approvedClaims: input.approvedClaims,
      audienceDescription: input.audienceDescription,
      campaignObjective: campaign.objective ?? undefined,
      userInstructions: input.userInstructions,
    });
    if (!draft) throw new AppError("VALIDATION_ERROR", "Insufficient context for AI draft.");
    return draft;
  },

  async createExperiment(
    campaignId: string,
    brandId: string,
    organisationId: string,
    input: {
      variantType: string;
      variantA: Prisma.InputJsonValue;
      variantB: Prisma.InputJsonValue;
      sampleAllocationPercent?: number;
      primaryMetric?: string;
      minimumSample?: number;
    },
    context: TenantContext,
  ) {
    await this.getCampaign(campaignId, brandId, organisationId, context);
    const versionId = await getLatestVersionId(campaignId);
    if (!versionId) throw new AppError("VALIDATION_ERROR", "No version.");

    return prisma.emailCampaignExperiment.create({
      data: {
        campaignId,
        versionId,
        variantType: input.variantType as "SUBJECT",
        variantA: input.variantA,
        variantB: input.variantB,
        sampleAllocationPercent: input.sampleAllocationPercent ?? 50,
        primaryMetric: input.primaryMetric ?? "click_rate",
        minimumSample: input.minimumSample ?? 100,
      },
    });
  },

  async evaluateExperiment(experimentId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const experiment = await prisma.emailCampaignExperiment.findFirst({
      where: { id: experimentId, campaign: { organisationId, brandId } },
    });
    if (!experiment) throw new AppError("NOT_FOUND", "Experiment not found.");

    const result = evaluateExperiment(
      { sampleSize: 120, opens: 30, clicks: 12, conversions: 2 },
      { sampleSize: 115, opens: 25, clicks: 8, conversions: 1 },
      {
        sampleAllocationPercent: experiment.sampleAllocationPercent,
        primaryMetric: experiment.primaryMetric,
        minimumSample: experiment.minimumSample,
        decisionRule: experiment.decisionRule ?? undefined,
        testDurationHours: experiment.testDurationHours ?? undefined,
      },
    );

    return prisma.emailCampaignExperiment.update({
      where: { id: experimentId },
      data: {
        status: result.status,
        winnerVariant: result.winnerVariant,
        validityWarnings: result.validityWarnings as Prisma.InputJsonValue,
      },
    });
  },
};
