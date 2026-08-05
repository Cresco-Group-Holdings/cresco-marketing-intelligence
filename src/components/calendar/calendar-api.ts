import { apiFetch } from "@/lib/api/client";
import type {
  CalendarConflictsResponse,
  CalendarEvent,
  CalendarEventsResponse,
  CalendarFilters,
  CalendarViewMode,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
} from "@/components/calendar/types";

export class CalendarApiError extends Error {
  readonly code: string;
  readonly isVersionConflict: boolean;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CalendarApiError";
    this.code = code;
    this.isVersionConflict = code === "VERSION_CONFLICT";
  }
}

function buildFilterParams(
  organisationId: string,
  filters?: CalendarFilters,
): URLSearchParams {
  const params = new URLSearchParams({ organisationId });
  if (filters?.projectId) params.set("projectId", filters.projectId);
  if (filters?.brandId) params.set("brandId", filters.brandId);
  if (filters?.campaignId) params.set("campaignId", filters.campaignId);
  if (filters?.channel) params.set("channel", filters.channel);
  if (filters?.eventType) params.set("eventType", filters.eventType);
  return params;
}

export function formatCalendarError(error: unknown): string {
  if (error instanceof CalendarApiError) {
    if (error.isVersionConflict) {
      return "This event was updated elsewhere. Reload to get the latest version, then try again.";
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Request failed.";
}

export async function listCalendarEvents(
  organisationId: string,
  options: {
    from: string;
    to: string;
    view: CalendarViewMode;
    filters?: CalendarFilters;
  },
): Promise<CalendarEventsResponse> {
  const params = buildFilterParams(organisationId, options.filters);
  params.set("from", options.from);
  params.set("to", options.to);
  params.set("view", options.view);

  return apiFetch<CalendarEventsResponse>(`/api/calendar/events?${params.toString()}`, {
    organisationId,
  });
}

export async function getCalendarEvent(
  eventId: string,
  organisationId: string,
): Promise<CalendarEvent> {
  const params = new URLSearchParams({ organisationId });
  return apiFetch<CalendarEvent>(`/api/calendar/events/${eventId}?${params.toString()}`, {
    organisationId,
  });
}

export async function createCalendarEvent(
  organisationId: string,
  input: CreateCalendarEventInput,
): Promise<CalendarEvent> {
  const params = new URLSearchParams({ organisationId });
  return apiFetch<CalendarEvent>(`/api/calendar/events?${params.toString()}`, {
    method: "POST",
    organisationId,
    body: JSON.stringify(input),
  });
}

export async function updateCalendarEvent(
  eventId: string,
  organisationId: string,
  input: UpdateCalendarEventInput,
): Promise<CalendarEvent> {
  const params = new URLSearchParams({ organisationId });
  return apiFetch<CalendarEvent>(`/api/calendar/events/${eventId}?${params.toString()}`, {
    method: "PATCH",
    organisationId,
    body: JSON.stringify(input),
  });
}

export async function cancelCalendarEvent(
  eventId: string,
  organisationId: string,
): Promise<CalendarEvent> {
  const params = new URLSearchParams({ organisationId });
  return apiFetch<CalendarEvent>(`/api/calendar/events/${eventId}/cancel?${params.toString()}`, {
    method: "POST",
    organisationId,
  });
}

export async function listUpcomingEvents(
  organisationId: string,
  filters?: CalendarFilters,
): Promise<CalendarEventsResponse> {
  const params = buildFilterParams(organisationId, filters);
  return apiFetch<CalendarEventsResponse>(`/api/calendar/upcoming?${params.toString()}`, {
    organisationId,
  });
}

export async function listUnscheduledEvents(
  organisationId: string,
  filters?: CalendarFilters,
): Promise<CalendarEventsResponse> {
  const params = buildFilterParams(organisationId, filters);
  return apiFetch<CalendarEventsResponse>(`/api/calendar/unscheduled?${params.toString()}`, {
    organisationId,
  });
}

export async function listOverdueEvents(
  organisationId: string,
  filters?: CalendarFilters,
): Promise<CalendarEventsResponse> {
  const params = buildFilterParams(organisationId, filters);
  return apiFetch<CalendarEventsResponse>(`/api/calendar/overdue?${params.toString()}`, {
    organisationId,
  });
}

export async function listCalendarConflicts(
  organisationId: string,
  from: string,
  to: string,
  filters?: CalendarFilters,
): Promise<CalendarConflictsResponse> {
  const params = buildFilterParams(organisationId, filters);
  params.set("from", from);
  params.set("to", to);
  return apiFetch<CalendarConflictsResponse>(`/api/calendar/conflicts?${params.toString()}`, {
    organisationId,
  });
}
