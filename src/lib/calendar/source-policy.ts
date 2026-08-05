import type { CalendarEvent } from "@prisma/client";
import {
  CALENDAR_SOURCE_ENTITY_TYPES,
  type CalendarSourceEntityType,
} from "@/lib/calendar/constants";

export function isSourceLocked(event: Pick<CalendarEvent, "sourceLocked">): boolean {
  return event.sourceLocked;
}

export function canRescheduleEvent(
  event: Pick<CalendarEvent, "sourceLocked" | "sourceEntityType" | "status">,
): boolean {
  if (event.status === "CANCELLED" || event.status === "COMPLETED") return false;
  if (!event.sourceLocked) return true;
  return event.sourceEntityType != null && isReschedulableSource(event.sourceEntityType);
}

function isReschedulableSource(sourceEntityType: string): boolean {
  return (
    sourceEntityType === CALENDAR_SOURCE_ENTITY_TYPES.ContentSchedule ||
    sourceEntityType === CALENDAR_SOURCE_ENTITY_TYPES.ContentTask ||
    sourceEntityType === CALENDAR_SOURCE_ENTITY_TYPES.Campaign ||
    sourceEntityType === CALENDAR_SOURCE_ENTITY_TYPES.ContentDeadline
  );
}

export function allowedRescheduleTargets(
  event: Pick<CalendarEvent, "sourceEntityType" | "type">,
): CalendarSourceEntityType[] {
  if (!event.sourceEntityType) return [];
  switch (event.sourceEntityType) {
    case CALENDAR_SOURCE_ENTITY_TYPES.ContentSchedule:
      return [CALENDAR_SOURCE_ENTITY_TYPES.ContentSchedule];
    case CALENDAR_SOURCE_ENTITY_TYPES.ContentTask:
      return [CALENDAR_SOURCE_ENTITY_TYPES.ContentTask];
    case CALENDAR_SOURCE_ENTITY_TYPES.Campaign:
      return [CALENDAR_SOURCE_ENTITY_TYPES.Campaign];
    case CALENDAR_SOURCE_ENTITY_TYPES.ContentDeadline:
      return [CALENDAR_SOURCE_ENTITY_TYPES.ContentDeadline];
    default:
      return [];
  }
}

export function rescheduleBlockedReason(
  event: Pick<CalendarEvent, "sourceLocked" | "sourceEntityType" | "status" | "type">,
): string | null {
  if (event.status === "CANCELLED") return "Cancelled calendar events cannot be rescheduled.";
  if (event.status === "COMPLETED") return "Completed calendar events cannot be rescheduled.";
  if (!event.sourceLocked) return null;
  if (!event.sourceEntityType || !isReschedulableSource(event.sourceEntityType)) {
    return `Derived ${event.type} events must be rescheduled via their source record.`;
  }
  return null;
}
