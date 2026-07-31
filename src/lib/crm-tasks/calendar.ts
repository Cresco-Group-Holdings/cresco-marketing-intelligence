import type { CrmCalendarProvider } from "@prisma/client";

export type CalendarIntegrationPoint = {
  provider: CrmCalendarProvider;
  supportsScheduling: boolean;
  scopes: string[];
};

export const CALENDAR_INTEGRATION_POINTS: CalendarIntegrationPoint[] = [
  {
    provider: "GOOGLE",
    supportsScheduling: true,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  },
  {
    provider: "MICROSOFT",
    supportsScheduling: true,
    scopes: ["Calendars.ReadWrite"],
  },
  {
    provider: "SCHEDULING_PROVIDER",
    supportsScheduling: true,
    scopes: ["scheduling.links.read", "scheduling.bookings.read"],
  },
];

export type CalendarEventMapping = {
  externalEventId?: string;
  calendarProvider?: CrmCalendarProvider;
  meetingActivityId?: string;
  opportunityId?: string;
  leadId?: string;
  participantIds: string[];
  outcome?: string;
  followUpTaskId?: string;
};

export function mapMeetingToCrmRecords(mapping: CalendarEventMapping): Record<string, unknown> {
  return {
    externalEventId: mapping.externalEventId ?? null,
    calendarProvider: mapping.calendarProvider ?? null,
    meetingActivityId: mapping.meetingActivityId ?? null,
    opportunityId: mapping.opportunityId ?? null,
    leadId: mapping.leadId ?? null,
    participantCount: mapping.participantIds.length,
    outcome: mapping.outcome ?? null,
    followUpTaskId: mapping.followUpTaskId ?? null,
    privateDetailsExcluded: true,
  };
}
