import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { canMarketToLead, minimiseLeadExport, redactDeletedLead } from "@/lib/leads/privacy";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";

export const leadPrivacyService = {
  async updateConsent(
    brandId: string,
    organisationId: string,
    leadId: string,
    input: {
      consentState: import("@prisma/client").LeadConsentState;
      lawfulBasis?: string;
      marketingOptIn?: boolean;
      suppressed?: boolean;
      notes?: string;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const lead = await prisma.marketingLead.findFirst({
      where: { id: leadId, organisationId, brandId, status: { not: "DELETED" } },
    });
    if (!lead) {
      throw new AppError("NOT_FOUND", "Lead was not found.");
    }

    const consent = await prisma.leadConsent.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        marketingLeadId: leadId,
        consentState: input.consentState,
        lawfulBasis: input.lawfulBasis || lead.lawfulBasisPlaceholder,
        marketingOptIn: input.marketingOptIn ?? false,
        suppressed: input.suppressed ?? false,
        notes: input.notes || null,
        recordedByUserId: context.userProfileId,
      },
    });

    if (input.suppressed) {
      await prisma.marketingLead.update({
        where: { id: leadId },
        data: { retentionStatus: "SUPPRESSED" },
      });
      await prisma.leadActivity.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          marketingLeadId: leadId,
          activityType: "SUPPRESSED",
          summary: "Lead suppressed from future marketing.",
          actorUserId: context.userProfileId,
        },
      });
    }

    await prisma.leadActivity.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        marketingLeadId: leadId,
        activityType: "CONSENT_UPDATED",
        summary: `Consent updated to ${input.consentState}.`,
        actorUserId: context.userProfileId,
      },
    });

    return consent;
  },

  async exportIndividualRecord(
    brandId: string,
    organisationId: string,
    leadId: string,
    context: TenantContext,
  ) {
    const lead = await prisma.marketingLead.findFirst({
      where: { id: leadId, organisationId, brandId },
      include: {
        source: true,
        consents: { orderBy: { recordedAt: "desc" } },
        activities: { orderBy: { createdAt: "desc" }, take: 100 },
        qualifications: true,
      },
    });
    if (!lead) {
      throw new AppError("NOT_FOUND", "Lead was not found.");
    }

    const latestConsent = lead.consents[0];
    return {
      lead: minimiseLeadExport(lead, "FULL"),
      source: lead.source,
      consents: lead.consents,
      activities: lead.activities,
      qualifications: lead.qualifications,
      canMarket: latestConsent
        ? canMarketToLead({
            retentionStatus: lead.retentionStatus,
            marketingOptIn: latestConsent.marketingOptIn,
            suppressed: latestConsent.suppressed,
          })
        : false,
    };
  },

  async deleteLead(
    brandId: string,
    organisationId: string,
    leadId: string,
    context: TenantContext,
    reason?: string,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const lead = await prisma.marketingLead.findFirst({
      where: { id: leadId, organisationId, brandId, status: { not: "DELETED" } },
    });
    if (!lead) {
      throw new AppError("NOT_FOUND", "Lead was not found.");
    }

    const redacted = redactDeletedLead();
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.marketingLead.update({
        where: { id: leadId },
        data: {
          status: "DELETED",
          retentionStatus: "DELETED",
          deletedAt: new Date(),
          ...redacted,
        },
      });
      await tx.leadActivity.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          marketingLeadId: leadId,
          activityType: "DELETED",
          summary: reason || "Lead deleted per privacy request.",
          actorUserId: context.userProfileId,
        },
      });
      return result;
    });

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "lead.deleted",
      resourceType: "MarketingLead",
      resourceId: leadId,
      metadata: { reason },
    });

    return updated;
  },
};
