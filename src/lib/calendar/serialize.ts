import type { CalendarEvent, UserProfile } from "@prisma/client";

type OwnerSelect = Pick<UserProfile, "id" | "displayName" | "email">;

function serializeUser(user: OwnerSelect | null | undefined) {
  if (!user) return null;
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
  };
}

export function serializeCalendarEvent(
  event: CalendarEvent & {
    createdBy?: OwnerSelect | null;
    updatedBy?: OwnerSelect | null;
    brand?: { name: string } | null;
    campaign?: { name: string } | null;
    contentItem?: { title: string } | null;
  },
) {
  return {
    id: event.id,
    workspaceId: event.organisationId,
    organisationId: event.organisationId,
    projectId: event.projectId,
    brandId: event.brandId,
    brandName: event.brand?.name ?? null,
    campaignId: event.campaignId,
    campaignName: event.campaign?.name ?? null,
    contentItemId: event.contentItemId,
    contentItemTitle: event.contentItem?.title ?? null,
    title: event.title,
    description: event.description,
    type: event.type,
    status: event.status,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    allDay: event.allDay,
    timezone: event.timezone,
    color: event.color,
    location: event.location,
    sourceEntityType: event.sourceEntityType,
    sourceEntityId: event.sourceEntityId,
    sourceLocked: event.sourceLocked,
    channelType: event.channelType,
    metadata: event.metadata,
    cancelledAt: event.cancelledAt?.toISOString() ?? null,
    version: event.version,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
    createdBy: serializeUser(event.createdBy),
    updatedBy: serializeUser(event.updatedBy),
  };
}

export function serializeCalendarEventList(events: CalendarEvent[]) {
  return events.map((event) => serializeCalendarEvent(event));
}
