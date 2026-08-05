import type { LeadQualificationProfile } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { evaluateQualificationRules } from "@/lib/leads/qualification-rules";
import type { TenantContext } from "@/lib/tenancy/context";
import { getOrganisationNotifierUserIds } from "@/lib/notifications/recipients";
import { recordAuditEvent } from "@/server/services/audit-service";
import { notificationEventService } from "@/server/services/notification-event-service";
import { brandService } from "@/server/services/workspace-service";

export const leadQualificationService = {
  async upsert(
    brandId: string,
    organisationId: string,
    leadId: string,
    input: {
      profile: LeadQualificationProfile;
      answers: Record<string, string | boolean | null>;
      qualified?: boolean;
      reviewNotes?: string;
      aiSuggested?: boolean;
      aiRequestId?: string;
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

    const evaluation = evaluateQualificationRules(input.profile, input.answers);
    const qualified = input.qualified ?? evaluation.qualified;
    const requiresReview = input.aiSuggested ?? false;

    const qualification = await prisma.leadQualification.upsert({
      where: {
        marketingLeadId_profile: {
          marketingLeadId: leadId,
          profile: input.profile,
        },
      },
      create: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        marketingLeadId: leadId,
        profile: input.profile,
        answers: input.answers,
        score: evaluation.missingFields.length === 0 ? 100 : 50,
        qualified,
        aiSuggested: input.aiSuggested ?? false,
        aiRequestId: input.aiRequestId,
        requiresReview,
        reviewedByUserId: input.aiSuggested ? null : context.userProfileId,
        reviewedAt: input.aiSuggested ? null : new Date(),
        reviewNotes: input.reviewNotes || null,
      },
      update: {
        answers: input.answers,
        score: evaluation.missingFields.length === 0 ? 100 : 50,
        qualified,
        aiSuggested: input.aiSuggested ?? false,
        aiRequestId: input.aiRequestId,
        requiresReview,
        reviewedByUserId: input.aiSuggested ? undefined : context.userProfileId,
        reviewedAt: input.aiSuggested ? undefined : new Date(),
        reviewNotes: input.reviewNotes || null,
      },
    });

    const nextStatus = qualified ? "QUALIFIED" : lead.status === "NEW" ? "REVIEWING" : lead.status;
    await prisma.$transaction([
      prisma.marketingLead.update({
        where: { id: leadId },
        data: { status: nextStatus },
      }),
      prisma.leadActivity.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          marketingLeadId: leadId,
          activityType: "QUALIFICATION_UPDATED",
          summary: `Qualification updated for ${input.profile}.`,
          actorUserId: context.userProfileId,
          metadata: { qualified, profile: input.profile, aiSuggested: input.aiSuggested ?? false },
        },
      }),
    ]);

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "lead.qualification.updated",
      resourceType: "LeadQualification",
      resourceId: qualification.id,
      metadata: { leadId, profile: input.profile, qualified },
    });

    if (qualified && lead.status !== "QUALIFIED") {
      const recipientUserIds = await getOrganisationNotifierUserIds(organisationId);
      await notificationEventService
        .newQualifiedLead({
          organisationId,
          projectId: brand.projectId,
          brandId,
          leadId,
          recipientUserIds: recipientUserIds.filter((id) => id !== context.userProfileId),
          idempotencyKey: `lead-qualified:${leadId}:${input.profile}`,
        })
        .catch(() => undefined);
    }

    return qualification;
  },
};
