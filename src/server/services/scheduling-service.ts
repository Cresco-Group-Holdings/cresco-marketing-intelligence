import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import type { ScheduleCreateInput } from "@/lib/validation/scheduling";
import { recordAuditEvent } from "@/server/services/audit-service";
import { complianceAgentService } from "@/server/services/compliance-agent-service";
import { brandService } from "@/server/services/workspace-service";

export const schedulingService = {
  async schedule(brandId: string, organisationId: string, contentId: string, input: ScheduleCreateInput, context: TenantContext, requestId?: string) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const scheduledFor = new Date(input.scheduledFor);
    if (scheduledFor <= new Date()) throw new AppError("VALIDATION_ERROR", "Scheduling in the past is not allowed.");
    const item = await prisma.contentItem.findFirst({ where: { id: contentId, organisationId, brandId, archivedAt: null }, include: { variants: true } });
    if (!item || item.status !== "APPROVED") throw new AppError("VALIDATION_ERROR", "Only approved content may be scheduled.");
    await complianceAgentService.assertPublishable(brandId, organisationId, contentId, context, input.contentVariantId);
    const variant = item.variants.find((entry) => entry.id === input.contentVariantId);
    if (!variant || variant.socialAccountId !== input.socialAccountId || (variant.validationErrors && Array.isArray(variant.validationErrors) && variant.validationErrors.length)) throw new AppError("VALIDATION_ERROR", "Variant must be valid and assigned to the selected account.");
    const account = await prisma.socialAccount.findFirst({ where: { id: input.socialAccountId, organisationId, brandId, status: "CONNECTED", socialConnection: { status: "CONNECTED" } } });
    if (!account) throw new AppError("VALIDATION_ERROR", "Social account is not connected.");
    const duplicate = await prisma.contentSchedule.findFirst({ where: { contentVariantId: variant.id, scheduledFor, status: { not: "CANCELLED" } } });
    const conflicts = await prisma.contentSchedule.count({ where: { socialAccountId: account.id, scheduledFor: { gte: new Date(scheduledFor.getTime() - 15 * 60_000), lte: new Date(scheduledFor.getTime() + 15 * 60_000) }, status: { not: "CANCELLED" } } });
    const schedule = await prisma.contentSchedule.create({ data: { organisationId, projectId: brand.projectId, brandId, contentItemId: contentId, contentVariantId: variant.id, socialAccountId: account.id, scheduledFor, timezone: input.timezone, status: "READY", recurrence: input.recurrence, createdByUserId: context.userProfileId } });
    await prisma.contentItem.update({ where: { id: contentId }, data: { status: "SCHEDULED" } });
    await recordAuditEvent({ organisationId, projectId: brand.projectId, actorUserId: context.userProfileId, action: "content.scheduled", resourceType: "contentSchedule", resourceId: schedule.id, requestId, metadata: { duplicateWarning: Boolean(duplicate), conflictWarning: conflicts > 0 } });
    return { schedule, warnings: { duplicate: Boolean(duplicate), conflict: conflicts > 0 } };
  },
  async list(brandId: string, organisationId: string, context: TenantContext, from: Date, to: Date) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.contentSchedule.findMany({ where: { organisationId, brandId, scheduledFor: { gte: from, lte: to } }, include: { contentItem: true, contentVariant: true, socialAccount: true }, orderBy: { scheduledFor: "asc" } });
  },
};
