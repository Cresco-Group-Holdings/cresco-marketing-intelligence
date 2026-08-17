import type { CalendarEventType } from "@prisma/client";

export const DEFAULT_CALENDAR_TIMEZONE = "UTC";

export const CALENDAR_EVENT_TYPES = {
  CONTENT_PUBLICATION: "CONTENT_PUBLICATION",
  CAMPAIGN_START: "CAMPAIGN_START",
  CAMPAIGN_END: "CAMPAIGN_END",
  TASK_DEADLINE: "TASK_DEADLINE",
  REVIEW: "REVIEW",
  MANUAL: "MANUAL",
} as const satisfies Record<string, CalendarEventType>;

export const CALENDAR_SOURCE_ENTITY_TYPES = {
  ContentSchedule: "ContentSchedule",
  Publication: "Publication",
  Campaign: "Campaign",
  ContentTask: "ContentTask",
  ContentDeadline: "ContentDeadline",
} as const;

export type CalendarSourceEntityType =
  (typeof CALENDAR_SOURCE_ENTITY_TYPES)[keyof typeof CALENDAR_SOURCE_ENTITY_TYPES];

export const CALENDAR_VIEW_MODES = ["day", "week", "month", "agenda"] as const;

export type CalendarViewMode = (typeof CALENDAR_VIEW_MODES)[number];

export const DERIVED_CALENDAR_EVENT_TYPES: CalendarEventType[] = [
  CALENDAR_EVENT_TYPES.CONTENT_PUBLICATION,
  CALENDAR_EVENT_TYPES.CAMPAIGN_START,
  CALENDAR_EVENT_TYPES.CAMPAIGN_END,
  CALENDAR_EVENT_TYPES.TASK_DEADLINE,
  CALENDAR_EVENT_TYPES.REVIEW,
];
