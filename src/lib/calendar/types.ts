import type { CalendarEventType } from "@prisma/client";

export type CalendarEventReference = {
  eventId: string;
  workspaceId: string;
  organisationId: string;
  brandId: string;
  type: CalendarEventType;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  startsAt: string;
  endsAt?: string | null;
};

export type CalendarEventLink = {
  module: "content" | "campaign" | "task" | "deadline" | "manual";
  path: string;
  label: string;
};

export function buildCalendarEventLink(reference: CalendarEventReference): CalendarEventLink | null {
  if (reference.sourceEntityType === "ContentSchedule" && reference.sourceEntityId) {
    return {
      module: "content",
      path: `/content/${reference.sourceEntityId}`,
      label: "View schedule",
    };
  }
  if (reference.sourceEntityType === "Campaign" && reference.sourceEntityId) {
    return {
      module: "campaign",
      path: `/campaigns/${reference.sourceEntityId}`,
      label: "View campaign",
    };
  }
  if (reference.sourceEntityType === "ContentTask" && reference.sourceEntityId) {
    return {
      module: "task",
      path: `/tasks/${reference.sourceEntityId}`,
      label: "View task",
    };
  }
  if (reference.sourceEntityType === "ContentDeadline" && reference.sourceEntityId) {
    return {
      module: "deadline",
      path: `/deadlines/${reference.sourceEntityId}`,
      label: "View deadline",
    };
  }
  if (reference.type === "MANUAL") {
    return {
      module: "manual",
      path: `/calendar/events/${reference.eventId}`,
      label: "View event",
    };
  }
  return null;
}
