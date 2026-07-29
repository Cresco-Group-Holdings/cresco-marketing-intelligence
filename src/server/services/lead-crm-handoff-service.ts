import type { Prisma } from "@prisma/client";
import type { CrmProvider } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { getCrmAdapter } from "@/lib/leads/crm-adapter";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";

export const leadCrmHandoffService = {
  async handoff(
    brandId: string,
    organisationId: string,
    leadId: string,
    input: { provider: CrmProvider; idempotencyKey: string; webhookUrl?: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const lead = await prisma.marketingLead.findFirst({
      where: { id: leadId, organisationId, brandId, status: { not: "DELETED" } },
      include: { source: true, consents: { orderBy: { recordedAt: "desc" }, take: 1 } },
    });
    if (!lead) {
      throw new AppError("NOT_FOUND", "Lead was not found.");
    }

    const existing = await prisma.crmHandoff.findUnique({
      where: {
        marketingLeadId_provider_idempotencyKey: {
          marketingLeadId: leadId,
          provider: input.provider,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (existing && existing.status === "SENT") {
      return { handoff: existing, duplicate: true };
    }

    const adapter = getCrmAdapter(input.provider);
    const result = await adapter.handoff({
      idempotencyKey: input.idempotencyKey,
      webhookUrl: input.webhookUrl,
      payload: {
        leadId: lead.id,
        displayName: lead.displayName ?? undefined,
        email: lead.email ?? undefined,
        phone: lead.phone ?? undefined,
        company: lead.company ?? undefined,
        jobRole: lead.jobRole ?? undefined,
        country: lead.country ?? undefined,
        expressedInterest: lead.expressedInterest ?? undefined,
        status: lead.status,
        source: lead.source?.creationSource ?? "MANUAL",
        provider: lead.sourcePlatform ?? undefined,
        campaign: lead.sourceCampaign ?? undefined,
        metadata: {
          consentState: lead.consents[0]?.consentState,
          marketingOptIn: lead.consents[0]?.marketingOptIn ?? false,
        },
      },
    });

    const handoff = await prisma.crmHandoff.upsert({
      where: {
        marketingLeadId_provider_idempotencyKey: {
          marketingLeadId: leadId,
          provider: input.provider,
          idempotencyKey: input.idempotencyKey,
        },
      },
      create: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        marketingLeadId: leadId,
        provider: input.provider,
        idempotencyKey: input.idempotencyKey,
        status: result.status,
        externalId: result.externalId ?? null,
        errorMessage: result.errorMessage ?? null,
        payload: {
          leadId,
          provider: input.provider,
        },
        response: (result.response ?? undefined) as Prisma.InputJsonValue | undefined,
        attemptedAt: new Date(),
        completedAt: result.status === "SENT" ? new Date() : null,
      },
      update: {
        status: result.status,
        externalId: result.externalId ?? null,
        errorMessage: result.errorMessage ?? null,
        response: (result.response ?? undefined) as Prisma.InputJsonValue | undefined,
        attemptedAt: new Date(),
        completedAt: result.status === "SENT" ? new Date() : null,
      },
    });

    await prisma.leadActivity.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        marketingLeadId: leadId,
        activityType: "CRM_HANDOFF",
        summary: `CRM handoff ${result.status} via ${input.provider}.`,
        actorUserId: context.userProfileId,
        metadata: { provider: input.provider, status: result.status },
      },
    });

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "lead.crm.handoff",
      resourceType: "CrmHandoff",
      resourceId: handoff.id,
      metadata: { leadId, provider: input.provider, status: result.status },
    });

    return { handoff, duplicate: false };
  },
};
