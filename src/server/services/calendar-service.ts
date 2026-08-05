import type { CalendarEventStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { detectOverlappingEvents } from "@/lib/calendar/conflicts";
import {
  CALENDAR_EVENT_TYPES,
  CALENDAR_SOURCE_ENTITY_TYPES,
  DEFAULT_CALENDAR_TIMEZONE,
} from "@/lib/calendar/constants";
import { serializeCalendarEvent } from "@/lib/calendar/serialize";
import {
  canRescheduleEvent,
  isSourceLocked,
  rescheduleBlockedReason,
} from "@/lib/calendar/source-policy";
import {
  buildAllDayRange,
  calendarRangeBoundaries,
  resolveCalendarTimezone,
} from "@/lib/calendar/timezone";
import { AppError } from "@/lib/errors";
import { assertOrganisationScope, type TenantContext } from "@/lib/tenancy/context";
import type {
  CalendarCreateInput,
  CalendarListFilters,
  CalendarRescheduleInput,
  CalendarUpdateInput,
} from "@/lib/validation/calendar";
import { recordAuditEvent } from "@/server/services/audit-service";
import { calendarProjectionService } from "@/server/services/calendar-projection-service";
import { brandService } from "@/server/services/workspace-service";

const eventDetailInclude = {
  createdBy: { select: { id: true, displayName: true, email: true } },
  updatedBy: { select: { id: true, displayName: true, email: true } },
  brand: { select: { name: true } },
  campaign: { select: { name: true } },
  contentItem: { select: { title: true } },
} satisfies Prisma.CalendarEventInclude;

async function getEventOrThrow(eventId: string, organisationId: string) {
  const event = await prisma.calendarEvent.findFirst({
    where: { id: eventId, organisationId },
    include: eventDetailInclude,
  });
  if (!event) throw new AppError("NOT_FOUND", "Calendar event not found.");
  return event;
}

async function resolveBrandScope(brandId: string, organisationId: string, context: TenantContext) {
  const brand = await brandService.getById(brandId, organisationId, context);
  return {
    organisationId,
    projectId: brand.projectId,
    brandId,
    brandTimezone: brand.analyticsTimezone,
  };
}

function buildListWhere(organisationId: string, filters: CalendarListFilters): Prisma.CalendarEventWhereInput {
  return {
    organisationId,
    status: filters.status ?? { not: "CANCELLED" },
    ...(filters.brandId ? { brandId: filters.brandId } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
    ...(filters.channel ? { channelType: filters.channel } : {}),
    ...(filters.types?.length ? { type: { in: filters.types } } : {}),
    startsAt: { lte: new Date(filters.to) },
    OR: [
      { endsAt: { gte: new Date(filters.from) } },
      { endsAt: null, startsAt: { gte: new Date(filters.from) } },
    ],
  };
}

async function updateEventWithVersion(
  eventId: string,
  organisationId: string,
  expectedVersion: number,
  data: Prisma.CalendarEventUpdateInput,
) {
  const result = await prisma.calendarEvent.updateMany({
    where: { id: eventId, organisationId, version: expectedVersion },
    data: { ...data, version: { increment: 1 } },
  });

  if (result.count === 0) {
    const exists = await prisma.calendarEvent.findFirst({ where: { id: eventId, organisationId } });
    if (!exists) throw new AppError("NOT_FOUND", "Calendar event not found.");
    throw new AppError("CONFLICT", "CALENDAR_EVENT_VERSION_CONFLICT");
  }

  return getEventOrThrow(eventId, organisationId);
}

async function rescheduleContentSchedule(
  scheduleId: string,
  organisationId: string,
  startsAt: Date,
  actorUserId: string,
) {
  const schedule = await prisma.contentSchedule.findFirst({
    where: { id: scheduleId, organisationId, cancelledAt: null },
  });
  if (!schedule) throw new AppError("NOT_FOUND", "Content schedule not found.");
  await prisma.contentSchedule.update({
    where: { id: scheduleId },
    data: { scheduledFor: startsAt },
  });
  await calendarProjectionService.syncContentSchedules(
    organisationId,
    new Date(startsAt.getTime() - 86_400_000),
    new Date(startsAt.getTime() + 86_400_000),
  );
  return schedule;
}

async function rescheduleContentTask(
  taskId: string,
  organisationId: string,
  dueAt: Date,
  actorUserId: string,
) {
  const task = await prisma.contentTask.findFirst({ where: { id: taskId, organisationId } });
  if (!task) throw new AppError("NOT_FOUND", "Content task not found.");
  await prisma.contentTask.update({
    where: { id: taskId },
    data: { dueAt },
  });
  await calendarProjectionService.syncContentTasks(
    organisationId,
    new Date(dueAt.getTime() - 86_400_000),
    new Date(dueAt.getTime() + 86_400_000),
  );
  return task;
}

async function rescheduleCampaignDates(
  campaignId: string,
  organisationId: string,
  eventType: string,
  startsAt: Date,
  actorUserId: string,
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, organisationId, archivedAt: null },
  });
  if (!campaign) throw new AppError("NOT_FOUND", "Campaign not found.");

  const data =
    eventType === CALENDAR_EVENT_TYPES.CAMPAIGN_START
      ? { startAt: startsAt }
      : eventType === CALENDAR_EVENT_TYPES.CAMPAIGN_END
        ? { endAt: startsAt }
        : null;
  if (!data) {
    throw new AppError("VALIDATION_ERROR", "Campaign source events must be start or end markers.");
  }

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { ...data, version: { increment: 1 } },
  });
  await calendarProjectionService.syncCampaigns(
    organisationId,
    new Date(startsAt.getTime() - 86_400_000),
    new Date(startsAt.getTime() + 86_400_000),
  );
  return campaign;
}

async function rescheduleContentDeadline(
  deadlineId: string,
  organisationId: string,
  dueAt: Date,
) {
  const deadline = await prisma.contentDeadline.findFirst({
    where: { id: deadlineId, organisationId },
  });
  if (!deadline) throw new AppError("NOT_FOUND", "Content deadline not found.");
  await prisma.contentDeadline.update({
    where: { id: deadlineId },
    data: { dueAt },
  });
  await calendarProjectionService.syncContentDeadlines(
    organisationId,
    new Date(dueAt.getTime() - 86_400_000),
    new Date(dueAt.getTime() + 86_400_000),
  );
  return deadline;
}

async function rescheduleViaSource(
  event: Awaited<ReturnType<typeof getEventOrThrow>>,
  startsAt: Date,
  actorUserId: string,
) {
  if (!event.sourceEntityType || !event.sourceEntityId) {
    throw new AppError("VALIDATION_ERROR", "Derived event is missing source linkage.");
  }

  switch (event.sourceEntityType) {
    case CALENDAR_SOURCE_ENTITY_TYPES.ContentSchedule:
      await rescheduleContentSchedule(event.sourceEntityId, event.organisationId, startsAt, actorUserId);
      break;
    case CALENDAR_SOURCE_ENTITY_TYPES.ContentTask:
      await rescheduleContentTask(event.sourceEntityId, event.organisationId, startsAt, actorUserId);
      break;
    case CALENDAR_SOURCE_ENTITY_TYPES.Campaign:
      await rescheduleCampaignDates(
        event.sourceEntityId,
        event.organisationId,
        event.type,
        startsAt,
        actorUserId,
      );
      break;
    case CALENDAR_SOURCE_ENTITY_TYPES.ContentDeadline:
      await rescheduleContentDeadline(event.sourceEntityId, event.organisationId, startsAt);
      break;
    default:
      throw new AppError(
        "VALIDATION_ERROR",
        `Rescheduling is not supported for source type ${event.sourceEntityType}.`,
      );
  }

  return getEventOrThrow(event.id, event.organisationId);
}

export const calendarService = {
  async listEvents(
    organisationId: string,
    filters: CalendarListFilters,
    context: TenantContext,
  ) {
    assertOrganisationScope(organisationId, context);

    const organisation = await prisma.organisation.findFirst({
      where: { id: organisationId },
      select: { defaultTimezone: true },
    });

    const range = calendarRangeBoundaries(
      new Date(filters.from),
      new Date(filters.to),
      resolveCalendarTimezone(
        filters.timezone,
        null,
        organisation?.defaultTimezone ?? DEFAULT_CALENDAR_TIMEZONE,
      ),
      filters.view ?? "month",
    );

    await calendarProjectionService.syncOrganisationRange({
      organisationId,
      from: range.from,
      to: range.to,
    });

    const limit = filters.limit ?? 100;
    const items = await prisma.calendarEvent.findMany({
      where: buildListWhere(organisationId, filters),
      include: eventDetailInclude,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;

    return {
      items: page.map((event) => serializeCalendarEvent(event)),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        timezone: range.timezone,
      },
    };
  },

  async createManualEvent(
    organisationId: string,
    input: CalendarCreateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    assertOrganisationScope(organisationId, context);
    const scope = await resolveBrandScope(input.brandId, organisationId, context);

    const organisation = await prisma.organisation.findFirst({
      where: { id: organisationId },
      select: { defaultTimezone: true },
    });
    const timezone = resolveCalendarTimezone(
      input.timezone,
      scope.brandTimezone,
      organisation?.defaultTimezone,
    );

    const startsAt = new Date(input.startsAt);
    const endsAt = input.endsAt ? new Date(input.endsAt) : null;
    const allDay = input.allDay ?? false;
    const normalizedStarts = allDay ? buildAllDayRange(startsAt, timezone).startsAt : startsAt;
    const normalizedEnds =
      allDay
        ? buildAllDayRange(startsAt, timezone).endsAt
        : endsAt ?? new Date(normalizedStarts.getTime() + 60 * 60_000);

    const event = await prisma.calendarEvent.create({
      data: {
        organisationId: scope.organisationId,
        projectId: input.projectId ?? scope.projectId,
        brandId: scope.brandId,
        campaignId: input.campaignId ?? null,
        contentItemId: input.contentItemId ?? null,
        title: input.title,
        description: input.description || null,
        type: input.type ?? CALENDAR_EVENT_TYPES.MANUAL,
        status: input.status ?? "SCHEDULED",
        startsAt: normalizedStarts,
        endsAt: normalizedEnds,
        allDay,
        timezone,
        color: input.color || null,
        location: input.location || null,
        channelType: input.channelType || null,
        metadata: input.metadata ?? undefined,
        sourceLocked: false,
        createdByUserId: context.userProfileId,
        updatedByUserId: context.userProfileId,
      },
      include: eventDetailInclude,
    });

    await recordAuditEvent({
      organisationId,
      projectId: event.projectId,
      actorUserId: context.userProfileId,
      action: "calendar.event.created",
      resourceType: "CalendarEvent",
      resourceId: event.id,
      requestId,
      metadata: { type: event.type, manual: true },
    });

    return serializeCalendarEvent(event);
  },

  async getEvent(eventId: string, organisationId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    const event = await getEventOrThrow(eventId, organisationId);
    return serializeCalendarEvent(event);
  },

  async updateEvent(
    eventId: string,
    organisationId: string,
    input: CalendarUpdateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    assertOrganisationScope(organisationId, context);
    const existing = await getEventOrThrow(eventId, organisationId);

    if (isSourceLocked(existing)) {
      const timingChange =
        input.startsAt != null || input.endsAt !== undefined || input.allDay != null;
      if (timingChange) {
        throw new AppError(
          "VALIDATION_ERROR",
          rescheduleBlockedReason(existing) ??
            "Derived calendar events cannot be moved directly. Reschedule via the calendar reschedule endpoint.",
        );
      }
    }

    const timezone = input.timezone
      ? resolveCalendarTimezone(input.timezone)
      : existing.timezone;

    const data: Prisma.CalendarEventUpdateInput = {
      title: input.title,
      description: input.description,
      status: input.status,
      timezone: input.timezone,
      color: input.color,
      location: input.location,
      channelType: input.channelType,
      metadata: input.metadata ?? undefined,
      updatedByUserId: context.userProfileId,
    };

    if (input.allDay != null) data.allDay = input.allDay;
    if (input.startsAt) {
      const startsAt = new Date(input.startsAt);
      data.startsAt = input.allDay ?? existing.allDay
        ? buildAllDayRange(startsAt, timezone).startsAt
        : startsAt;
    }
    if (input.endsAt !== undefined) {
      data.endsAt =
        input.endsAt == null
          ? null
          : input.allDay ?? existing.allDay
            ? buildAllDayRange(new Date(input.endsAt), timezone).endsAt
            : new Date(input.endsAt);
    }

    const updated = await updateEventWithVersion(
      eventId,
      organisationId,
      input.version,
      data,
    );

    await recordAuditEvent({
      organisationId,
      projectId: updated.projectId,
      actorUserId: context.userProfileId,
      action: "calendar.event.updated",
      resourceType: "CalendarEvent",
      resourceId: updated.id,
      requestId,
    });

    return serializeCalendarEvent(updated);
  },

  async rescheduleEvent(
    eventId: string,
    organisationId: string,
    input: CalendarRescheduleInput,
    context: TenantContext,
    requestId?: string,
  ) {
    assertOrganisationScope(organisationId, context);
    const existing = await getEventOrThrow(eventId, organisationId);

    if (!canRescheduleEvent(existing)) {
      throw new AppError(
        "VALIDATION_ERROR",
        rescheduleBlockedReason(existing) ?? "This calendar event cannot be rescheduled.",
      );
    }

    const startsAt = new Date(input.startsAt);
    const timezone = input.timezone
      ? resolveCalendarTimezone(input.timezone)
      : existing.timezone;
    const allDay = input.allDay ?? existing.allDay;
    const normalizedStarts = allDay ? buildAllDayRange(startsAt, timezone).startsAt : startsAt;
    const normalizedEnds =
      input.endsAt != null
        ? allDay
          ? buildAllDayRange(new Date(input.endsAt), timezone).endsAt
          : new Date(input.endsAt)
        : allDay
          ? buildAllDayRange(startsAt, timezone).endsAt
          : new Date(normalizedStarts.getTime() + (existing.endsAt && existing.startsAt
              ? existing.endsAt.getTime() - existing.startsAt.getTime()
              : 60 * 60_000));

    let updated: Awaited<ReturnType<typeof getEventOrThrow>>;

    if (isSourceLocked(existing)) {
      if (existing.version !== input.version) {
        throw new AppError("CONFLICT", "CALENDAR_EVENT_VERSION_CONFLICT");
      }
      updated = await rescheduleViaSource(existing, normalizedStarts, context.userProfileId);
    } else {
      updated = await updateEventWithVersion(eventId, organisationId, input.version, {
        startsAt: normalizedStarts,
        endsAt: normalizedEnds,
        allDay,
        timezone: input.timezone ?? existing.timezone,
        updatedByUserId: context.userProfileId,
      });
    }

    await recordAuditEvent({
      organisationId,
      projectId: updated.projectId,
      actorUserId: context.userProfileId,
      action: "calendar.event.rescheduled",
      resourceType: "CalendarEvent",
      resourceId: updated.id,
      requestId,
      metadata: {
        startsAt: normalizedStarts.toISOString(),
        sourceLocked: existing.sourceLocked,
        sourceEntityType: existing.sourceEntityType,
      },
    });

    return serializeCalendarEvent(updated);
  },

  async cancelEvent(
    eventId: string,
    organisationId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    assertOrganisationScope(organisationId, context);
    const existing = await getEventOrThrow(eventId, organisationId);

    if (isSourceLocked(existing)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Derived calendar events must be cancelled at their source record.",
      );
    }

    const updated = await prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        updatedByUserId: context.userProfileId,
        version: { increment: 1 },
      },
      include: eventDetailInclude,
    });

    await recordAuditEvent({
      organisationId,
      projectId: updated.projectId,
      actorUserId: context.userProfileId,
      action: "calendar.event.cancelled",
      resourceType: "CalendarEvent",
      resourceId: updated.id,
      requestId,
    });

    return serializeCalendarEvent(updated);
  },

  async listUpcoming(
    organisationId: string,
    filters: { brandId?: string; projectId?: string; campaignId?: string; limit?: number },
    context: TenantContext,
  ) {
    assertOrganisationScope(organisationId, context);
    const now = new Date();
    const horizon = new Date(now.getTime() + 30 * 86_400_000);

    await calendarProjectionService.syncOrganisationRange({
      organisationId,
      from: now,
      to: horizon,
    });

    const limit = filters.limit ?? 25;
    const events = await prisma.calendarEvent.findMany({
      where: {
        organisationId,
        status: { in: ["SCHEDULED", "TENTATIVE", "IN_PROGRESS"] },
        startsAt: { gte: now },
        ...(filters.brandId ? { brandId: filters.brandId } : {}),
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.campaignId ? { campaignId: filters.campaignId } : {}),
      },
      include: eventDetailInclude,
      orderBy: { startsAt: "asc" },
      take: limit,
    });

    return events.map((event) => serializeCalendarEvent(event));
  },

  async listUnscheduledContent(
    brandId: string,
    organisationId: string,
    context: TenantContext,
    limit = 25,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);

    const items = await prisma.contentItem.findMany({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        archivedAt: null,
        status: { in: ["APPROVED", "SCHEDULED", "IN_REVIEW"] },
        schedules: {
          none: {
            cancelledAt: null,
            status: { notIn: ["CANCELLED", "COMPLETED"] },
          },
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        contentCampaignId: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    return items.map((item) => ({
      contentItemId: item.id,
      title: item.title,
      status: item.status,
      contentCampaignId: item.contentCampaignId,
      updatedAt: item.updatedAt.toISOString(),
      workspaceId: organisationId,
      organisationId,
      brandId: scope.brandId,
    }));
  },

  async listOverduePublications(
    organisationId: string,
    filters: { brandId?: string; projectId?: string; limit?: number },
    context: TenantContext,
  ) {
    assertOrganisationScope(organisationId, context);
    const now = new Date();
    const limit = filters.limit ?? 50;

    const schedules = await prisma.contentSchedule.findMany({
      where: {
        organisationId,
        cancelledAt: null,
        scheduledFor: { lt: now },
        status: { notIn: ["COMPLETED", "PARTIALLY_COMPLETED", "CANCELLED"] },
        ...(filters.brandId ? { brandId: filters.brandId } : {}),
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
      },
      include: {
        contentItem: { select: { id: true, title: true, status: true } },
        socialAccount: { select: { provider: true, displayName: true } },
      },
      orderBy: { scheduledFor: "asc" },
      take: limit,
    });

    return schedules.map((schedule) => ({
      scheduleId: schedule.id,
      contentItemId: schedule.contentItemId,
      contentItemTitle: schedule.contentItem.title,
      contentItemStatus: schedule.contentItem.status,
      scheduledFor: schedule.scheduledFor.toISOString(),
      timezone: schedule.timezone,
      status: schedule.status,
      channelType: schedule.socialAccount.provider,
      channelName: schedule.socialAccount.displayName,
      workspaceId: organisationId,
      organisationId,
      brandId: schedule.brandId,
      overdueByMinutes: Math.floor((now.getTime() - schedule.scheduledFor.getTime()) / 60_000),
    }));
  },

  async detectConflicts(
    organisationId: string,
    from: Date,
    to: Date,
    context: TenantContext,
    options?: { brandId?: string; channel?: string; timezone?: string },
  ) {
    assertOrganisationScope(organisationId, context);

    await calendarProjectionService.syncOrganisationRange({
      organisationId,
      from,
      to,
    });

    const events = await prisma.calendarEvent.findMany({
      where: {
        organisationId,
        status: { not: "CANCELLED" },
        ...(options?.brandId ? { brandId: options.brandId } : {}),
        startsAt: { lte: to },
        OR: [{ endsAt: { gte: from } }, { endsAt: null, startsAt: { gte: from } }],
      },
    });

    return detectOverlappingEvents(events, { channelType: options?.channel });
  },
};
