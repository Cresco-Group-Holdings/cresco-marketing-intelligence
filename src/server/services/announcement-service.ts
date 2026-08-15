import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { sanitizeCommentBody } from "@/lib/collaboration/mention-parser";
import type { TenantContext } from "@/lib/tenancy/context";
import { assertOrganisationScope } from "@/lib/tenancy/context";

export const announcementService = {
  async listActive(organisationId: string | null, userId: string) {
    const now = new Date();
    const announcements = await prisma.announcement.findMany({
      where: {
        AND: [
          { OR: [{ organisationId }, { organisationId: null }] },
          { startsAt: { lte: now } },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      include: {
        dismissals: { where: { userId } },
      },
      orderBy: { priority: "desc" },
      take: 5,
    });

    return announcements
      .filter((item) => item.dismissals.length === 0)
      .map((item) => ({
        id: item.id,
        title: item.title,
        body: item.sanitizedBody,
        priority: item.priority,
        actionUrl: item.actionUrl,
        dismissible: item.dismissible,
        startsAt: item.startsAt.toISOString(),
        endsAt: item.endsAt?.toISOString() ?? null,
      }));
  },

  async create(
    organisationId: string,
    input: {
      title: string;
      body: string;
      priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
      actionUrl?: string;
      startsAt?: string;
      endsAt?: string;
      dismissible?: boolean;
    },
    context: TenantContext,
  ) {
    assertOrganisationScope(organisationId, context);
    const sanitized = sanitizeCommentBody(input.body);
    return prisma.announcement.create({
      data: {
        organisationId,
        title: input.title,
        body: input.body,
        sanitizedBody: sanitized,
        priority: input.priority ?? "NORMAL",
        actionUrl: input.actionUrl,
        startsAt: input.startsAt ? new Date(input.startsAt) : new Date(),
        endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
        dismissible: input.dismissible ?? true,
        createdByUserId: context.userProfileId,
      },
    });
  },

  async dismiss(announcementId: string, userId: string, context: TenantContext) {
    const announcement = await prisma.announcement.findUnique({ where: { id: announcementId } });
    if (!announcement) throw new AppError("NOT_FOUND", "Announcement not found.");
    if (!announcement.dismissible) throw new AppError("VALIDATION_ERROR", "Announcement cannot be dismissed.");

    return prisma.announcementDismissal.upsert({
      where: { announcementId_userId: { announcementId, userId } },
      create: { announcementId, userId },
      update: { dismissedAt: new Date() },
    });
  },
};

export const digestSubscriptionService = {
  async upsert(
    organisationId: string,
    userId: string,
    input: {
      frequency: "DAILY" | "WEEKLY";
      timezone?: string;
      includeOverdue?: boolean;
      includeApprovals?: boolean;
      includeConnections?: boolean;
      includeCampaignAlerts?: boolean;
      enabled?: boolean;
    },
    context: TenantContext,
  ) {
    assertOrganisationScope(organisationId, context);
    return prisma.digestSubscription.upsert({
      where: {
        organisationId_userId_frequency: {
          organisationId,
          userId,
          frequency: input.frequency,
        },
      },
      create: {
        organisationId,
        userId,
        frequency: input.frequency,
        timezone: input.timezone ?? "UTC",
        includeOverdue: input.includeOverdue ?? true,
        includeApprovals: input.includeApprovals ?? true,
        includeConnections: input.includeConnections ?? true,
        includeCampaignAlerts: input.includeCampaignAlerts ?? true,
        enabled: input.enabled ?? true,
      },
      update: {
        timezone: input.timezone ?? "UTC",
        includeOverdue: input.includeOverdue,
        includeApprovals: input.includeApprovals,
        includeConnections: input.includeConnections,
        includeCampaignAlerts: input.includeCampaignAlerts,
        enabled: input.enabled,
      },
    });
  },

  async list(organisationId: string, userId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    return prisma.digestSubscription.findMany({
      where: { organisationId, userId },
      orderBy: { frequency: "asc" },
    });
  },
};
