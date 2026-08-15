import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { buildDuplicateEvidence, canAutoMerge } from "@/lib/crm/duplicates";
import {
  mapWorkflowToLifecycleStage,
  mapWorkflowToQualificationState,
  validateWorkflowTransition,
} from "@/lib/crm/lead-workflow";
import {
  buildAnonymisationPreview,
  minimiseCrmLeadExport,
  sanitiseActivityMetadata,
} from "@/lib/crm/pii-safe";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { crmService } from "@/server/services/crm-service";
import { brandService } from "@/server/services/workspace-service";

const coreLeadInclude = {
  person: { include: { contactMethods: true, contact: true } },
  company: true,
  source: true,
  owner: { select: { id: true, displayName: true } },
  qualificationAssessments: { orderBy: { assessedAt: "desc" as const }, take: 20 },
  consentRecords: { orderBy: { recordedAt: "desc" as const }, take: 20 },
  manualScores: { where: { supersededAt: null }, orderBy: { scoredAt: "desc" as const }, take: 5 },
  statusHistory: { orderBy: { createdAt: "desc" as const }, take: 20 },
} satisfies Prisma.CrmLeadInclude;

async function getScopedLead(
  leadId: string,
  brandId: string,
  organisationId: string,
  context: TenantContext,
) {
  await brandService.getById(brandId, organisationId, context);
  const lead = await prisma.crmLead.findFirst({
    where: { id: leadId, organisationId, brandId, archivedAt: null },
    include: coreLeadInclude,
  });
  if (!lead) throw new AppError("NOT_FOUND", "CRM lead not found.");
  return lead;
}

function extractContactMethods(lead: Awaited<ReturnType<typeof getScopedLead>>) {
  const methods = lead.person?.contactMethods ?? [];
  const email = methods.find((m) => m.methodType === "EMAIL")?.displayValue;
  const phone = methods.find((m) => m.methodType === "PHONE" || m.methodType === "MOBILE")?.displayValue;
  return { email, phone };
}

export const crmLeadCoreService = {
  async getLeadCore(leadId: string, brandId: string, organisationId: string, context: TenantContext) {
    return getScopedLead(leadId, brandId, organisationId, context);
  },

  async transitionLead(
    leadId: string,
    brandId: string,
    organisationId: string,
    nextStatus: string,
    reason: string | undefined,
    context: TenantContext,
  ) {
    const lead = await getScopedLead(leadId, brandId, organisationId, context);
    const check = validateWorkflowTransition(lead.status, nextStatus);
    if (!check.valid) throw new AppError("VALIDATION_ERROR", check.error ?? "Invalid transition");

    const qualificationState = mapWorkflowToQualificationState(
      nextStatus as Parameters<typeof mapWorkflowToQualificationState>[0],
    );
    const lifecycleStage = mapWorkflowToLifecycleStage(
      nextStatus as Parameters<typeof mapWorkflowToLifecycleStage>[0],
    );

    return prisma.$transaction(async (tx) => {
      await tx.crmLeadStatusHistory.create({
        data: {
          leadId,
          previousStatus: lead.status,
          newStatus: nextStatus as Prisma.CrmLeadStatusHistoryCreateInput["newStatus"],
          actorUserId: context.userProfileId,
          reason,
          source: "WORKFLOW",
        },
      });
      await tx.crmActivityTimelineItem.create({
        data: {
          organisationId,
          brandId,
          leadId,
          itemType: "STATUS_CHANGE",
          title: `Workflow: ${lead.status} → ${nextStatus}`,
          actorUserId: context.userProfileId,
          metadata: sanitiseActivityMetadata({
            previousStatus: lead.status,
            newStatus: nextStatus,
            source: "WORKFLOW",
          }) as Prisma.InputJsonValue,
        },
      });
      return tx.crmLead.update({
        where: { id: leadId },
        data: {
          status: nextStatus as Prisma.CrmLeadUpdateInput["status"],
          qualificationState,
          lifecycleStage,
          lastActivityAt: new Date(),
        },
        include: coreLeadInclude,
      });
    });
  },

  async recordQualificationAssessment(
    brandId: string,
    organisationId: string,
    input: {
      leadId: string;
      outcome: string;
      criteria?: Record<string, unknown>;
      notes?: string;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    await getScopedLead(input.leadId, brandId, organisationId, context);

    const assessment = await prisma.$transaction(async (tx) => {
      const created = await tx.crmQualificationAssessment.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          leadId: input.leadId,
          assessorUserId: context.userProfileId,
          outcome: input.outcome as Prisma.CrmQualificationAssessmentCreateInput["outcome"],
          criteria: input.criteria as Prisma.InputJsonValue,
          notes: input.notes,
          metadata: sanitiseActivityMetadata({ criteriaKeys: Object.keys(input.criteria ?? {}) }) as Prisma.InputJsonValue,
        },
      });
      await tx.crmLead.update({
        where: { id: input.leadId },
        data: {
          qualificationState: input.outcome as Prisma.CrmLeadUpdateInput["qualificationState"],
          lastActivityAt: new Date(),
        },
      });
      await tx.crmActivityTimelineItem.create({
        data: {
          organisationId,
          brandId,
          leadId: input.leadId,
          itemType: "NOTE",
          title: `Qualification assessment: ${input.outcome}`,
          actorUserId: context.userProfileId,
          metadata: sanitiseActivityMetadata({ outcome: input.outcome }) as Prisma.InputJsonValue,
        },
      });
      return created;
    });

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "crm.lead.qualification_assessed",
      resourceType: "CrmLead",
      resourceId: input.leadId,
      metadata: { outcome: input.outcome },
    });

    return assessment;
  },

  async recordConsent(
    brandId: string,
    organisationId: string,
    input: {
      leadId: string;
      channel: string;
      status: string;
      lawfulBasis?: string;
      marketingOptIn?: boolean;
      suppressed?: boolean;
      contactEligible?: boolean;
      notes?: string;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const lead = await getScopedLead(input.leadId, brandId, organisationId, context);

    const consent = await prisma.$transaction(async (tx) => {
      const created = await tx.crmConsentRecord.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          leadId: input.leadId,
          channel: input.channel,
          status: input.status as Prisma.CrmConsentRecordCreateInput["status"],
          lawfulBasis: input.lawfulBasis as Prisma.CrmConsentRecordCreateInput["lawfulBasis"],
          marketingOptIn: input.marketingOptIn ?? false,
          suppressed: input.suppressed ?? false,
          contactEligible: input.contactEligible ?? true,
          notes: input.notes,
          recordedByUserId: context.userProfileId,
        },
      });

      const leadUpdate: Prisma.CrmLeadUpdateInput = {
        lastActivityAt: new Date(),
      };
      if (input.lawfulBasis) {
        leadUpdate.lawfulBasis = input.lawfulBasis as Prisma.CrmLeadUpdateInput["lawfulBasis"];
      }
      if (input.suppressed) {
        leadUpdate.retentionStatus = "SUPPRESSED";
      }
      await tx.crmLead.update({ where: { id: input.leadId }, data: leadUpdate });

      await tx.crmActivityTimelineItem.create({
        data: {
          organisationId,
          brandId,
          leadId: input.leadId,
          itemType: "CONSENT_CHANGE",
          title: `Consent ${input.status} for ${input.channel}`,
          actorUserId: context.userProfileId,
          metadata: sanitiseActivityMetadata({
            channel: input.channel,
            status: input.status,
            marketingOptIn: input.marketingOptIn,
          }) as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "crm.lead.consent_recorded",
      resourceType: "CrmLead",
      resourceId: lead.id,
      metadata: { channel: input.channel, status: input.status },
    });

    return consent;
  },

  async recordManualScore(
    brandId: string,
    organisationId: string,
    input: {
      leadId: string;
      score: number;
      maxScore?: number;
      rationale?: string;
      criteria?: Record<string, unknown>;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    await getScopedLead(input.leadId, brandId, organisationId, context);
    const maxScore = input.maxScore ?? 100;
    if (input.score > maxScore) {
      throw new AppError("VALIDATION_ERROR", "Score cannot exceed max score.");
    }

    return prisma.$transaction(async (tx) => {
      await tx.crmLeadManualScore.updateMany({
        where: { leadId: input.leadId, supersededAt: null },
        data: { supersededAt: new Date() },
      });
      const created = await tx.crmLeadManualScore.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          leadId: input.leadId,
          score: input.score,
          maxScore,
          rationale: input.rationale,
          criteria: input.criteria as Prisma.InputJsonValue,
          scoredByUserId: context.userProfileId,
        },
      });
      await tx.crmActivityTimelineItem.create({
        data: {
          organisationId,
          brandId,
          leadId: input.leadId,
          itemType: "NOTE",
          title: `Manual score: ${input.score}/${maxScore}`,
          actorUserId: context.userProfileId,
          metadata: sanitiseActivityMetadata({ score: input.score, maxScore }) as Prisma.InputJsonValue,
        },
      });
      return created;
    });
  },

  async detectDuplicates(
    brandId: string,
    organisationId: string,
    input: { email?: string; phone?: string; externalProvider?: string; externalId?: string },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const evidence = buildDuplicateEvidence(input);
    if (evidence.length === 0) return { candidates: [], evidence: [], autoMergeEligible: false };

    const candidates: Array<{ leadId: string; displayName: string | null }> = [];
    if (input.email) {
      const matches = await prisma.crmContactMethod.findMany({
        where: {
          methodType: "EMAIL",
          normalisedValue: input.email.toLowerCase(),
          person: { leads: { some: { organisationId, brandId, archivedAt: null } } },
        },
        include: { person: { include: { leads: { where: { organisationId, brandId, archivedAt: null } } } } },
        take: 10,
      });
      for (const match of matches) {
        for (const lead of match.person.leads) {
          candidates.push({ leadId: lead.id, displayName: match.person.displayName });
        }
      }
    }

    return {
      evidence,
      candidates,
      autoMergeEligible: canAutoMerge(evidence),
    };
  },

  async exportLead(
    leadId: string,
    brandId: string,
    organisationId: string,
    scope: "FULL" | "SUMMARY",
    context: TenantContext,
  ) {
    const lead = await getScopedLead(leadId, brandId, organisationId, context);
    const { email, phone } = extractContactMethods(lead);

    const exportRecord = minimiseCrmLeadExport(
      {
        id: lead.id,
        status: lead.status,
        lifecycleStage: lead.lifecycleStage,
        qualificationState: lead.qualificationState,
        retentionStatus: lead.retentionStatus,
        lawfulBasis: lead.lawfulBasis,
        primaryProductInterest: lead.primaryProductInterest,
        country: lead.country,
        displayName: lead.person?.displayName,
        email,
        phone,
        companyName: lead.company?.tradingName ?? lead.company?.legalName,
        sourceType: lead.source?.sourceType,
        utmCampaign: lead.source?.utmCampaign,
        firstTouchCampaign: lead.source?.firstTouchCampaign,
        lastTouchCampaign: lead.source?.lastTouchCampaign,
      },
      scope,
    );

    await recordAuditEvent({
      organisationId,
      projectId: lead.projectId,
      actorUserId: context.userProfileId,
      action: "crm.lead.exported",
      resourceType: "CrmLead",
      resourceId: leadId,
      metadata: { scope },
    });

    return {
      lead: exportRecord,
      consents: lead.consentRecords,
      qualifications: lead.qualificationAssessments,
      manualScores: lead.manualScores,
    };
  },

  async archiveLead(
    leadId: string,
    brandId: string,
    organisationId: string,
    reason: string | undefined,
    context: TenantContext,
  ) {
    const lead = await getScopedLead(leadId, brandId, organisationId, context);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.crmLead.update({
        where: { id: leadId },
        data: {
          archivedAt: new Date(),
          status: "ARCHIVED",
          retentionStatus: "ARCHIVED",
        },
        include: coreLeadInclude,
      });
      await tx.crmActivityTimelineItem.create({
        data: {
          organisationId,
          brandId,
          leadId,
          itemType: "STATUS_CHANGE",
          title: "Lead archived",
          actorUserId: context.userProfileId,
          metadata: sanitiseActivityMetadata({ reason }) as Prisma.InputJsonValue,
        },
      });
      return result;
    });

    await recordAuditEvent({
      organisationId,
      projectId: lead.projectId,
      actorUserId: context.userProfileId,
      action: "crm.lead.archived",
      resourceType: "CrmLead",
      resourceId: leadId,
      metadata: { reason },
    });

    return updated;
  },

  async prepareAnonymisation(leadId: string, brandId: string, organisationId: string, context: TenantContext) {
    const lead = await getScopedLead(leadId, brandId, organisationId, context);
    const preview = buildAnonymisationPreview(leadId);

    await prisma.crmLead.update({
      where: { id: leadId },
      data: {
        retentionStatus: "DELETION_REQUESTED",
        deletionRequestedAt: new Date(),
      },
    });

    await recordAuditEvent({
      organisationId,
      projectId: lead.projectId,
      actorUserId: context.userProfileId,
      action: "crm.lead.anonymisation_requested",
      resourceType: "CrmLead",
      resourceId: leadId,
    });

    return preview;
  },

  async listWorkflowLeads(brandId: string, organisationId: string, context: TenantContext, status?: string) {
    return crmService.listLeads(brandId, organisationId, context, { status });
  },
};
