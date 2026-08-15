export const CALENDAR_VIEW_MODES = ["month", "week", "list"] as const;
export type CalendarViewMode = (typeof CALENDAR_VIEW_MODES)[number];

export const CALENDAR_EVENT_TYPES = [
  "CONTENT_PUBLISH",
  "CAMPAIGN_MILESTONE",
  "DEADLINE",
  "MANUAL",
  "MEETING",
  "OTHER",
] as const;
export type CalendarEventType = (typeof CALENDAR_EVENT_TYPES)[number];

export const CALENDAR_EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  CONTENT_PUBLISH: "Content publish",
  CAMPAIGN_MILESTONE: "Campaign milestone",
  DEADLINE: "Deadline",
  MANUAL: "Manual event",
  MEETING: "Meeting",
  OTHER: "Other",
};

export const CALENDAR_EVENT_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "PUBLISHED",
  "CANCELLED",
  "OVERDUE",
  "FAILED",
] as const;
export type CalendarEventStatus = (typeof CALENDAR_EVENT_STATUSES)[number];

export const CALENDAR_EVENT_STATUS_LABELS: Record<CalendarEventStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  CANCELLED: "Cancelled",
  OVERDUE: "Overdue",
  FAILED: "Failed",
};

export const CALENDAR_CHANNELS = [
  "ORGANIC_SOCIAL",
  "PAID_SOCIAL",
  "EMAIL",
  "SEO",
  "PAID_SEARCH",
  "DISPLAY",
  "EVENTS",
  "PARTNERSHIPS",
] as const;
export type CalendarChannel = (typeof CALENDAR_CHANNELS)[number];

export const CALENDAR_CHANNEL_LABELS: Record<CalendarChannel, string> = {
  ORGANIC_SOCIAL: "Organic social",
  PAID_SOCIAL: "Paid social",
  EMAIL: "Email",
  SEO: "SEO",
  PAID_SEARCH: "Paid search",
  DISPLAY: "Display",
  EVENTS: "Events",
  PARTNERSHIPS: "Partnerships",
};

export type CalendarEvent = {
  id: string;
  organisationId: string;
  projectId?: string | null;
  brandId?: string | null;
  brandName?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  contentItemId?: string | null;
  contentTitle?: string | null;
  title: string;
  description?: string | null;
  eventType: CalendarEventType | string;
  channel?: CalendarChannel | string | null;
  status: CalendarEventStatus | string;
  startsAt: string;
  endsAt?: string | null;
  timezone: string;
  allDay?: boolean;
  version: number;
  hasConflict?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CalendarEventsResponse = {
  items: CalendarEvent[];
  from?: string;
  to?: string;
};

export type CalendarConflict = {
  id: string;
  eventIds: string[];
  reason: string;
  severity?: "warning" | "error" | string;
  startsAt?: string;
  endsAt?: string | null;
  channel?: string | null;
};

export type CalendarConflictsResponse = {
  items: CalendarConflict[];
};

export type CalendarFilters = {
  projectId?: string | null;
  brandId?: string | null;
  campaignId?: string | null;
  channel?: string | null;
  eventType?: string | null;
};

export type CreateCalendarEventInput = {
  title: string;
  description?: string;
  eventType?: string;
  channel?: string;
  brandId?: string;
  projectId?: string;
  campaignId?: string;
  startsAt: string;
  endsAt?: string;
  timezone: string;
  allDay?: boolean;
};

export type UpdateCalendarEventInput = {
  title?: string;
  description?: string;
  startsAt?: string;
  endsAt?: string | null;
  timezone?: string;
  channel?: string;
  campaignId?: string | null;
  version: number;
};

export type CalendarDateRange = {
  from: string;
  to: string;
};

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeek(date: Date): Date {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(next, diff);
}

export function endOfWeek(date: Date): Date {
  return endOfDay(addDays(startOfWeek(date), 6));
}

export function startOfMonth(date: Date): Date {
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function endOfMonth(date: Date): Date {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return startOfDay(new Date(year, month - 1, day));
}

export function getRangeForView(view: CalendarViewMode, anchor: Date): CalendarDateRange {
  if (view === "week") {
    return {
      from: startOfWeek(anchor).toISOString(),
      to: endOfWeek(anchor).toISOString(),
    };
  }
  if (view === "list") {
    const from = startOfDay(anchor);
    const to = endOfDay(addDays(from, 29));
    return { from: from.toISOString(), to: to.toISOString() };
  }
  const gridStart = startOfWeek(startOfMonth(anchor));
  const gridEnd = endOfWeek(endOfMonth(anchor));
  return { from: gridStart.toISOString(), to: gridEnd.toISOString() };
}

export function formatInTimezone(
  iso: string,
  timezone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      ...options,
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

export function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) {
    return formatInTimezone(event.startsAt, event.timezone, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }
  return formatInTimezone(event.startsAt, event.timezone, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function eventDurationMs(event: CalendarEvent): number {
  if (!event.endsAt) return 60 * 60 * 1000;
  return Math.max(new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime(), 60 * 60 * 1000);
}

export function rescheduleEventToDate(event: CalendarEvent, targetDate: Date): {
  startsAt: string;
  endsAt: string;
} {
  const originalStart = new Date(event.startsAt);
  const nextStart = new Date(targetDate);
  nextStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);
  const duration = eventDurationMs(event);
  const nextEnd = new Date(nextStart.getTime() + duration);
  return { startsAt: nextStart.toISOString(), endsAt: nextEnd.toISOString() };
}

export function groupEventsByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const grouped = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = toDateKey(new Date(event.startsAt));
    const list = grouped.get(key) ?? [];
    list.push(event);
    grouped.set(key, list);
  }
  for (const [, list] of grouped) {
    list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }
  return grouped;
}
