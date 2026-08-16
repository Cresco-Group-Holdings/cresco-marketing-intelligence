import type { ContentDeadlineType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import {
  CALENDAR_EVENT_TYPES,
  CALENDAR_SOURCE_ENTITY_TYPES,
  DEFAULT_CALENDAR_TIMEZONE,
} from "@/lib/calendar/constants";
import { buildAllDayRange } from "@/lib/calendar/timezone";

type ProjectionRange = {
  organisationId: string;
  from: Date;
  to: Date;
};

type UpsertDerivedEventInput = {
  organisationId: string;
  projectId: string;
  brandId: string;
  campaignId?: string | null;
  contentItemId?: string | null;
  title: string;
  description?: string | null;
  type: typeof CALENDAR_EVENT_TYPES[keyof typeof CALENDAR_EVENT_TYPES];
  startsAt: Date;
  endsAt?: Date | null;
  allDay?: boolean;
  timezone: string;
  channelType?: string | null;
  sourceEntityType: string;
  sourceEntityId: string;
  createdByUserId: string;
  status?: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  metadata?: Prisma.InputJsonValue;
};

async function upsertDerivedEvent(input: UpsertDerivedEventInput) {
  const existing = await prisma.calendarEvent.findFirst({
    where: {
      organisationId: input.organisationId,
      sourceEntityType: input.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      type: input.type,
    },
  });

  const data = {
    organisationId: input.organisationId,
    projectId: input.projectId,
    brandId: input.brandId,
    campaignId: input.campaignId ?? null,
    contentItemId: input.contentItemId ?? null,
    title: input.title,
    description: input.description ?? null,
    type: input.type,
    status: input.status ?? "SCHEDULED",
    startsAt: input.startsAt,
    endsAt: input.endsAt ?? null,
    allDay: input.allDay ?? false,
    timezone: input.timezone,
    channelType: input.channelType ?? null,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    sourceLocked: true,
    metadata: input.metadata,
    updatedByUserId: input.createdByUserId,
  };

  if (existing) {
    return prisma.calendarEvent.update({
      where: { id: existing.id },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });
  }

  return prisma.calendarEvent.create({
    data: {
      ...data,
      createdByUserId: input.createdByUserId,
    },
  });
}

function deadlineEventType(deadlineType: ContentDeadlineType) {
  if (deadlineType === "REVIEW_DEADLINE" || deadlineType === "APPROVAL_DEADLINE") {
    return CALENDAR_EVENT_TYPES.REVIEW;
  }
  return CALENDAR_EVENT_TYPES.TASK_DEADLINE;
}

function mapScheduleStatus(status: string): "SCHEDULED" | "COMPLETED" | "CANCELLED" {
  if (status === "COMPLETED" || status === "PARTIALLY_COMPLETED") return "COMPLETED";
  if (status === "CANCELLED") return "CANCELLED";
  return "SCHEDULED";
}

function mapPublicationStatus(status: string): "SCHEDULED" | "COMPLETED" | "CANCELLED" {
  if (status === "PUBLISHED" || status === "PARTIALLY_PUBLISHED") return "COMPLETED";
  if (status === "CANCELLED" || status === "REMOVED") return "CANCELLED";
  return "SCHEDULED";
}

export const calendarProjectionService = {
  async syncOrganisationRange(range: ProjectionRange) {
    const { organisationId, from, to } = range;

    await this.syncContentSchedules(organisationId, from, to);
    await this.syncPublications(organisationId, from, to);
    await this.syncCampaigns(organisationId, from, to);
    await this.syncContentTasks(organisationId, from, to);
    await this.syncContentDeadlines(organisationId, from, to);
  },

  async syncContentSchedules(organisationId: string, from: Date, to: Date) {
    const schedules = await prisma.contentSchedule.findMany({
      where: {
        organisationId,
        scheduledFor: { gte: from, lte: to },
        cancelledAt: null,
        status: { not: "CANCELLED" },
      },
      include: {
        contentItem: { select: { title: true, contentCampaignId: true } },
        socialAccount: { select: { provider: true } },
      },
    });

    for (const schedule of schedules) {
      await upsertDerivedEvent({
        organisationId: schedule.organisationId,
        projectId: schedule.projectId,
        brandId: schedule.brandId,
        campaignId: schedule.contentItem?.contentCampaignId,
        contentItemId: schedule.contentItemId,
        title: schedule.contentItem?.title ?? "Content publication",
        description: null,
        type: CALENDAR_EVENT_TYPES.CONTENT_PUBLICATION,
        startsAt: schedule.scheduledFor,
        endsAt: new Date(schedule.scheduledFor.getTime() + 30 * 60_000),
        timezone: schedule.timezone,
        channelType: schedule.socialAccount.provider,
        sourceEntityType: CALENDAR_SOURCE_ENTITY_TYPES.ContentSchedule,
        sourceEntityId: schedule.id,
        createdByUserId: schedule.createdByUserId,
        status: mapScheduleStatus(schedule.status),
        metadata: {
          contentVariantId: schedule.contentVariantId,
          socialAccountId: schedule.socialAccountId,
          scheduleStatus: schedule.status,
        },
      });
    }
  },

  async syncPublications(organisationId: string, from: Date, to: Date) {
    const publications = await prisma.publication.findMany({
      where: {
        organisationId,
        scheduledFor: { gte: from, lte: to },
        status: { in: ["SCHEDULED", "QUEUED", "PUBLISHING", "PUBLISHED", "FAILED", "CANCELLED"] },
      },
      include: {
        contentItem: { select: { title: true, contentCampaignId: true } },
      },
    });

    for (const publication of publications) {
      if (!publication.scheduledFor) continue;
      await upsertDerivedEvent({
        organisationId: publication.organisationId,
        projectId: publication.projectId,
        brandId: publication.brandId,
        campaignId: publication.contentItem?.contentCampaignId,
        contentItemId: publication.contentItemId,
        title: publication.contentItem?.title ?? "Scheduled publication",
        description: publication.lastErrorMessage,
        type: CALENDAR_EVENT_TYPES.CONTENT_PUBLICATION,
        startsAt: publication.scheduledFor,
        endsAt: new Date(publication.scheduledFor.getTime() + 30 * 60_000),
        timezone: publication.timezone,
        channelType: publication.providerKey,
        sourceEntityType: CALENDAR_SOURCE_ENTITY_TYPES.Publication,
        sourceEntityId: publication.id,
        createdByUserId: publication.requestedByUserId,
        status: mapPublicationStatus(publication.status),
        metadata: {
          publicationStatus: publication.status,
          connectionId: publication.connectionId,
          externalAccountId: publication.externalAccountId,
        },
      });
    }
  },

  async syncPublication(publicationId: string) {
    const publication = await prisma.publication.findUnique({
      where: { id: publicationId },
      include: { contentItem: { select: { title: true } } },
    });
    if (!publication?.scheduledFor) return null;

    return upsertDerivedEvent({
      organisationId: publication.organisationId,
      projectId: publication.projectId,
      brandId: publication.brandId,
      campaignId: publication.campaignId,
      contentItemId: publication.contentItemId,
      title: publication.contentItem?.title ?? "Scheduled publication",
      description: publication.lastErrorMessage,
      type: CALENDAR_EVENT_TYPES.CONTENT_PUBLICATION,
      startsAt: publication.scheduledFor,
      endsAt: new Date(publication.scheduledFor.getTime() + 30 * 60_000),
      timezone: publication.timezone,
      channelType: publication.providerKey,
      sourceEntityType: CALENDAR_SOURCE_ENTITY_TYPES.Publication,
      sourceEntityId: publication.id,
      createdByUserId: publication.requestedByUserId,
      status: mapPublicationStatus(publication.status),
      metadata: {
        publicationStatus: publication.status,
        connectionId: publication.connectionId,
        externalPublicationId: publication.externalPublicationId,
      },
    });
  },

  async syncCampaigns(organisationId: string, from: Date, to: Date) {
    const campaigns = await prisma.campaign.findMany({
      where: {
        organisationId,
        archivedAt: null,
        OR: [
          { startAt: { gte: from, lte: to } },
          { endAt: { gte: from, lte: to } },
        ],
      },
    });

    for (const campaign of campaigns) {
      if (campaign.startAt) {
        const allDay = buildAllDayRange(campaign.startAt, campaign.timezone);
        await upsertDerivedEvent({
          organisationId: campaign.organisationId,
          projectId: campaign.projectId,
          brandId: campaign.brandId,
          campaignId: campaign.id,
          title: `${campaign.name} — start`,
          description: campaign.description,
          type: CALENDAR_EVENT_TYPES.CAMPAIGN_START,
          startsAt: allDay.startsAt,
          endsAt: allDay.endsAt,
          allDay: true,
          timezone: campaign.timezone,
          sourceEntityType: CALENDAR_SOURCE_ENTITY_TYPES.Campaign,
          sourceEntityId: campaign.id,
          createdByUserId: campaign.createdByUserId,
          metadata: { campaignStatus: campaign.status },
        });
      }

      if (campaign.endAt) {
        const allDay = buildAllDayRange(campaign.endAt, campaign.timezone);
        await upsertDerivedEvent({
          organisationId: campaign.organisationId,
          projectId: campaign.projectId,
          brandId: campaign.brandId,
          campaignId: campaign.id,
          title: `${campaign.name} — end`,
          description: campaign.description,
          type: CALENDAR_EVENT_TYPES.CAMPAIGN_END,
          startsAt: allDay.startsAt,
          endsAt: allDay.endsAt,
          allDay: true,
          timezone: campaign.timezone,
          sourceEntityType: CALENDAR_SOURCE_ENTITY_TYPES.Campaign,
          sourceEntityId: campaign.id,
          createdByUserId: campaign.createdByUserId,
          metadata: { campaignStatus: campaign.status },
        });
      }
    }
  },

  async syncContentTasks(organisationId: string, from: Date, to: Date) {
    const tasks = await prisma.contentTask.findMany({
      where: {
        organisationId,
        dueAt: { gte: from, lte: to },
      },
    });

    for (const task of tasks) {
      if (!task.dueAt) continue;
      await upsertDerivedEvent({
        organisationId: task.organisationId,
        projectId: task.projectId,
        brandId: task.brandId,
        campaignId: task.campaignId,
        contentItemId: task.contentItemId,
        title: task.title,
        description: task.description,
        type: CALENDAR_EVENT_TYPES.TASK_DEADLINE,
        startsAt: task.dueAt,
        endsAt: new Date(task.dueAt.getTime() + 60 * 60_000),
        timezone: DEFAULT_CALENDAR_TIMEZONE,
        sourceEntityType: CALENDAR_SOURCE_ENTITY_TYPES.ContentTask,
        sourceEntityId: task.id,
        createdByUserId: task.createdByUserId,
        status: task.status === "COMPLETED" ? "COMPLETED" : "SCHEDULED",
        metadata: { taskStatus: task.status, priority: task.priority },
      });
    }
  },

  async syncContentDeadlines(organisationId: string, from: Date, to: Date) {
    const deadlines = await prisma.contentDeadline.findMany({
      where: {
        organisationId,
        dueAt: { gte: from, lte: to },
        status: { notIn: ["CANCELLED", "COMPLETED"] },
      },
      include: {
        brand: { select: { projectId: true } },
        contentItem: { select: { title: true, createdByUserId: true } },
        task: { select: { title: true, createdByUserId: true } },
      },
    });

    const organisation = await prisma.organisation.findFirst({
      where: { id: organisationId },
      select: { createdByUserId: true },
    });

    for (const deadline of deadlines) {
      const eventType = deadlineEventType(deadline.deadlineType);
      const subject =
        deadline.contentItem?.title ?? deadline.task?.title ?? deadline.deadlineType;
      const createdByUserId =
        deadline.task?.createdByUserId ??
        deadline.contentItem?.createdByUserId ??
        organisation?.createdByUserId ??
        deadline.brandId;

      await upsertDerivedEvent({
        organisationId: deadline.organisationId,
        brandId: deadline.brandId,
        projectId: deadline.brand.projectId,
        campaignId: deadline.campaignId,
        contentItemId: deadline.contentItemId,
        title: `${subject} — ${deadline.deadlineType.replace(/_/g, " ").toLowerCase()}`,
        type: eventType,
        startsAt: deadline.dueAt,
        endsAt: new Date(deadline.dueAt.getTime() + 60 * 60_000),
        timezone: DEFAULT_CALENDAR_TIMEZONE,
        sourceEntityType: CALENDAR_SOURCE_ENTITY_TYPES.ContentDeadline,
        sourceEntityId: deadline.id,
        createdByUserId,
        status: "SCHEDULED",
        metadata: {
          deadlineType: deadline.deadlineType,
          deadlineStatus: deadline.status,
        },
      });
    }
  },
};
