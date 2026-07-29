import type {
  LeadActivityType,
  LeadCreationSource,
  MarketingLeadStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { findDuplicateLead } from "@/lib/leads/duplicate-detection";
import { ALLOWED_SOCIAL_LEAD_SOURCES } from "@/lib/leads/constants";
import { assertOrganisationScope, type TenantContext } from "@/lib/tenancy/context";
import type { LeadCreateInput, LeadUpdateInput } from "@/lib/validation/leads";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";

export type LeadFilters = {
  status?: MarketingLeadStatus;
  creationSource?: LeadCreationSource;
  provider?: import("@prisma/client").SocialProvider;
  assignedToUserId?: string;
  qualificationProfile?: import("@prisma/client").LeadQualificationProfile;
  qualifiedOnly?: boolean;
  duplicateWarning?: boolean;
  search?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  cursor?: string;
};

function assertAllowedCreationSource(source: LeadCreationSource) {
  if (source === ("SOCIAL_LIKE" as LeadCreationSource)) {
    throw new AppError("VALIDATION_ERROR", "Likes cannot create marketing leads.");
  }
}

async function loadLead(brandId: string, organisationId: string, leadId: string, context: TenantContext) {
  await brandService.getById(brandId, organisationId, context);
  const lead = await prisma.marketingLead.findFirst({
    where: { id: leadId, organisationId, brandId, status: { not: "DELETED" } },
  });
  if (!lead) {
    throw new AppError("NOT_FOUND", "Lead was not found.");
  }
  assertOrganisationScope(lead.organisationId, context);
  return lead;
}

async function recordActivity(
  lead: { id: string; organisationId: string; projectId: string; brandId: string },
  activityType: LeadActivityType,
  summary: string,
  actorUserId?: string,
  metadata?: Prisma.InputJsonValue,
) {
  return prisma.leadActivity.create({
    data: {
      organisationId: lead.organisationId,
      projectId: lead.projectId,
      brandId: lead.brandId,
      marketingLeadId: lead.id,
      activityType,
      summary,
      actorUserId,
      metadata,
    },
  });
}

export const marketingLeadService = {
  async create(
    brandId: string,
    organisationId: string,
    input: LeadCreateInput,
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    assertAllowedCreationSource(input.creationSource);

    if (
      ALLOWED_SOCIAL_LEAD_SOURCES.includes(input.creationSource) &&
      !input.originalInteraction?.trim() &&
      !input.expressedInterest?.trim()
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Social leads require the original interaction or expressed interest.",
      );
    }

    if (input.socialAccountId) {
      const account = await prisma.socialAccount.findFirst({
        where: {
          id: input.socialAccountId,
          organisationId,
          brandId,
        },
      });
      if (!account) {
        throw new AppError("VALIDATION_ERROR", "Social account was not found for this brand.");
      }
    }

    const candidates = await prisma.marketingLead.findMany({
      where: {
        organisationId,
        brandId,
        status: { not: "DELETED" },
      },
      select: {
        id: true,
        email: true,
        phone: true,
        providerUsername: true,
        sourcePlatform: true,
      },
      take: 500,
      orderBy: { createdAt: "desc" },
    });

    const duplicate = findDuplicateLead(candidates, input);

    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.marketingLead.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          displayName: input.displayName || null,
          providerUsername: input.providerUsername || null,
          providerProfileUrl: input.providerProfileUrl || null,
          email: input.email || null,
          phone: input.phone || null,
          company: input.company || null,
          jobRole: input.jobRole || null,
          country: input.country || null,
          expressedInterest: input.expressedInterest || null,
          sourcePlatform: input.sourcePlatform,
          sourcePostId: input.sourcePostId || null,
          sourceCampaign: input.sourceCampaign || null,
          originalInteraction: input.originalInteraction || null,
          socialConversationId: input.socialConversationId || null,
          socialAccountId: input.socialAccountId || null,
          contentItemId: input.contentItemId || null,
          primaryCta: input.primaryCta || null,
          destinationUrl: input.destinationUrl || null,
          conversionEventId: input.conversionEventId || null,
          firstInteractionAt: input.firstInteractionAt ? new Date(input.firstInteractionAt) : new Date(),
          latestInteractionAt: input.latestInteractionAt
            ? new Date(input.latestInteractionAt)
            : new Date(),
          lawfulBasisPlaceholder: input.lawfulBasisPlaceholder || null,
          duplicateOfLeadId: duplicate?.id ?? null,
          isDuplicateWarning: Boolean(duplicate),
          createdByUserId: context.userProfileId,
        },
      });

      await tx.leadSource.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          marketingLeadId: created.id,
          creationSource: input.creationSource,
          provider: input.sourcePlatform,
          socialAccountId: input.socialAccountId || null,
          providerPostId: input.sourcePostId || null,
          contentItemId: input.contentItemId || null,
          campaignName: input.sourceCampaign || null,
          cta: input.primaryCta || null,
          destinationUrl: input.destinationUrl || null,
          interactionReference: input.socialConversationId || null,
        },
      });

      await tx.leadConsent.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          marketingLeadId: created.id,
          consentState: input.consentState ?? "UNKNOWN",
          lawfulBasis: input.lawfulBasisPlaceholder || null,
          marketingOptIn: input.marketingOptIn ?? false,
          recordedByUserId: context.userProfileId,
        },
      });

      await tx.leadActivity.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          marketingLeadId: created.id,
          activityType: "CREATED",
          summary: `Lead created from ${input.creationSource}.`,
          actorUserId: context.userProfileId,
          metadata: duplicate ? { duplicateOfLeadId: duplicate.id } : undefined,
        },
      });

      return created;
    });

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "lead.created",
      resourceType: "MarketingLead",
      resourceId: lead.id,
      metadata: { creationSource: input.creationSource, duplicateWarning: Boolean(duplicate) },
    });

    return { lead, duplicateWarning: Boolean(duplicate), duplicateOfLeadId: duplicate?.id ?? null };
  },

  async update(
    brandId: string,
    organisationId: string,
    leadId: string,
    input: LeadUpdateInput,
    context: TenantContext,
  ) {
    const existing = await loadLead(brandId, organisationId, leadId, context);
    const updated = await prisma.marketingLead.update({
      where: { id: existing.id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.displayName !== undefined ? { displayName: input.displayName || null } : {}),
        ...(input.providerUsername !== undefined
          ? { providerUsername: input.providerUsername || null }
          : {}),
        ...(input.providerProfileUrl !== undefined
          ? { providerProfileUrl: input.providerProfileUrl || null }
          : {}),
        ...(input.email !== undefined ? { email: input.email || null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
        ...(input.company !== undefined ? { company: input.company || null } : {}),
        ...(input.jobRole !== undefined ? { jobRole: input.jobRole || null } : {}),
        ...(input.country !== undefined ? { country: input.country || null } : {}),
        ...(input.expressedInterest !== undefined
          ? { expressedInterest: input.expressedInterest || null }
          : {}),
        ...(input.assignedToUserId !== undefined
          ? { assignedToUserId: input.assignedToUserId }
          : {}),
      },
    });

    if (input.status && input.status !== existing.status) {
      await recordActivity(
        updated,
        "STATUS_CHANGED",
        `Status changed from ${existing.status} to ${input.status}.`,
        context.userProfileId,
        { fromStatus: existing.status, toStatus: input.status },
      );
    }

    return updated;
  },

  async assign(
    brandId: string,
    organisationId: string,
    leadId: string,
    input: { assignedToUserId: string; note?: string },
    context: TenantContext,
  ) {
    const lead = await loadLead(brandId, organisationId, leadId, context);
    const membership = await prisma.organisationMembership.findFirst({
      where: {
        organisationId,
        userId: input.assignedToUserId,
        status: "ACTIVE",
      },
    });
    if (!membership) {
      throw new AppError("VALIDATION_ERROR", "Assignee is not an active organisation member.");
    }

    const [assignment, updated] = await prisma.$transaction([
      prisma.leadAssignment.create({
        data: {
          organisationId,
          projectId: lead.projectId,
          brandId,
          marketingLeadId: lead.id,
          assignedToId: input.assignedToUserId,
          assignedById: context.userProfileId,
          note: input.note || null,
        },
      }),
      prisma.marketingLead.update({
        where: { id: lead.id },
        data: { assignedToUserId: input.assignedToUserId, status: lead.status === "NEW" ? "REVIEWING" : lead.status },
      }),
    ]);

    await recordActivity(
      updated,
      "ASSIGNED",
      `Lead assigned to ${input.assignedToUserId}.`,
      context.userProfileId,
      { note: input.note },
    );

    return { assignment, lead: updated };
  },

  async addNote(
    brandId: string,
    organisationId: string,
    leadId: string,
    note: string,
    context: TenantContext,
  ) {
    const lead = await loadLead(brandId, organisationId, leadId, context);
    return recordActivity(lead, "NOTE_ADDED", note, context.userProfileId);
  },
};
