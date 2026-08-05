/**
 * Provider-independent contracts for external calendar integrations.
 * OAuth and sync implementations are out of scope for Stage 6.
 */

export type ExternalCalendarProvider = "GOOGLE_CALENDAR" | "MICROSOFT_OUTLOOK" | "SOCIAL_PUBLISHING";

export type ExternalCalendarCapability = {
  provider: ExternalCalendarProvider;
  supportsRead: boolean;
  supportsWrite: boolean;
  supportsWebhook: boolean;
  scopes: string[];
};

export const EXTERNAL_CALENDAR_CAPABILITIES: ExternalCalendarCapability[] = [
  {
    provider: "GOOGLE_CALENDAR",
    supportsRead: true,
    supportsWrite: true,
    supportsWebhook: true,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  },
  {
    provider: "MICROSOFT_OUTLOOK",
    supportsRead: true,
    supportsWrite: true,
    supportsWebhook: true,
    scopes: ["Calendars.ReadWrite"],
  },
  {
    provider: "SOCIAL_PUBLISHING",
    supportsRead: true,
    supportsWrite: true,
    supportsWebhook: false,
    scopes: ["publishing.schedule.read", "publishing.schedule.write"],
  },
];

export type ExternalCalendarEventRef = {
  provider: ExternalCalendarProvider;
  externalEventId: string;
  calendarId?: string;
  etag?: string;
  syncStatus: "PENDING" | "SYNCED" | "FAILED" | "STALE";
  lastSyncedAt?: string;
};

export type ExternalCalendarSyncRequest = {
  provider: ExternalCalendarProvider;
  organisationId: string;
  brandId: string;
  from: string;
  to: string;
  timezone: string;
};

export type SocialPublishingCalendarSlot = {
  providerAccountId: string;
  channelType: string;
  scheduledFor: string;
  timezone: string;
  contentItemId?: string;
  contentVariantId?: string;
  status: "AVAILABLE" | "BOOKED" | "CONFLICT";
};

export type ExternalCalendarWritePayload = {
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  allDay?: boolean;
  timezone: string;
  location?: string;
  attendees?: string[];
  metadata?: Record<string, unknown>;
};

export interface ExternalCalendarAdapter {
  provider: ExternalCalendarProvider;
  listEvents(request: ExternalCalendarSyncRequest): Promise<ExternalCalendarEventRef[]>;
  upsertEvent(
    ref: ExternalCalendarEventRef,
    payload: ExternalCalendarWritePayload,
  ): Promise<ExternalCalendarEventRef>;
  deleteEvent(ref: ExternalCalendarEventRef): Promise<void>;
}

export interface SocialPublishingCalendarAdapter {
  provider: ExternalCalendarProvider;
  listPublishingSlots(
    request: ExternalCalendarSyncRequest,
  ): Promise<SocialPublishingCalendarSlot[]>;
  reserveSlot(slot: SocialPublishingCalendarSlot): Promise<SocialPublishingCalendarSlot>;
}
