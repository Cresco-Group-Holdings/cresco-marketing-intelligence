import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import type { CalendarEvent } from "@prisma/client";
import { detectOverlappingEvents } from "@/lib/calendar/conflicts";
import {
  canRescheduleEvent,
  isSourceLocked,
  rescheduleBlockedReason,
} from "@/lib/calendar/source-policy";
import {
  allDayEndsAt,
  allDayStartsAt,
  buildAllDayRange,
  formatCalendarEventForDisplay,
} from "@/lib/calendar/timezone";
import { CALENDAR_SOURCE_ENTITY_TYPES } from "@/lib/calendar/constants";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

function baseEvent(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: "evt-1",
    organisationId: "org-1",
    projectId: "proj-1",
    brandId: "brand-1",
    campaignId: null,
    contentItemId: null,
    title: "Launch post",
    description: null,
    type: "CONTENT_PUBLICATION",
    status: "SCHEDULED",
    startsAt: new Date("2026-08-10T14:00:00.000Z"),
    endsAt: new Date("2026-08-10T15:00:00.000Z"),
    allDay: false,
    timezone: "UTC",
    color: null,
    location: null,
    sourceEntityType: null,
    sourceEntityId: null,
    sourceLocked: false,
    channelType: "INSTAGRAM",
    metadata: null,
    cancelledAt: null,
    createdByUserId: "user-1",
    updatedByUserId: null,
    version: 1,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("calendar timezone helpers", () => {
  it("builds all-day range in UTC", () => {
    const date = new Date("2026-08-10T12:00:00.000Z");
    const range = buildAllDayRange(date, "UTC");
    expect(allDayStartsAt(date, "UTC").toISOString()).toBe(range.startsAt.toISOString());
    expect(allDayEndsAt(date, "UTC").getTime()).toBeGreaterThan(range.startsAt.getTime());
  });

  it("formats all-day events without time component", () => {
    const label = formatCalendarEventForDisplay({
      title: "Campaign kickoff",
      startsAt: new Date("2026-08-10T00:00:00.000Z"),
      endsAt: null,
      allDay: true,
      timezone: "UTC",
      type: "CAMPAIGN_START",
    });
    expect(label).toContain("(all day)");
    expect(label).toContain("Campaign kickoff");
  });
});

describe("calendar source policy", () => {
  it("locks derived events", () => {
    expect(
      isSourceLocked(
        baseEvent({
          sourceLocked: true,
          sourceEntityType: CALENDAR_SOURCE_ENTITY_TYPES.ContentSchedule,
          sourceEntityId: "sched-1",
        }),
      ),
    ).toBe(true);
  });

  it("allows rescheduling manual events", () => {
    expect(canRescheduleEvent(baseEvent({ sourceLocked: false }))).toBe(true);
  });

  it("blocks cancelled events", () => {
    expect(
      rescheduleBlockedReason(baseEvent({ status: "CANCELLED", sourceLocked: true })),
    ).toContain("Cancelled");
  });

  it("allows rescheduling source-linked content schedules via policy", () => {
    expect(
      canRescheduleEvent(
        baseEvent({
          sourceLocked: true,
          sourceEntityType: CALENDAR_SOURCE_ENTITY_TYPES.ContentSchedule,
        }),
      ),
    ).toBe(true);
  });
});

describe("calendar conflict detection", () => {
  it("detects overlapping events for the same brand", () => {
    const left = baseEvent({ id: "a", channelType: "INSTAGRAM" });
    const right = baseEvent({
      id: "b",
      startsAt: new Date("2026-08-10T14:30:00.000Z"),
      endsAt: new Date("2026-08-10T16:00:00.000Z"),
      channelType: "INSTAGRAM",
    });
    const conflicts = detectOverlappingEvents([left, right]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.eventId).toBe("a");
  });

  it("ignores cancelled events", () => {
    const left = baseEvent({ id: "a", status: "CANCELLED" });
    const right = baseEvent({
      id: "b",
      startsAt: new Date("2026-08-10T14:30:00.000Z"),
      endsAt: new Date("2026-08-10T16:00:00.000Z"),
    });
    expect(detectOverlappingEvents([left, right])).toHaveLength(0);
  });

  it("does not flag different brands", () => {
    const left = baseEvent({ id: "a", brandId: "brand-1" });
    const right = baseEvent({
      id: "b",
      brandId: "brand-2",
      startsAt: new Date("2026-08-10T14:30:00.000Z"),
      endsAt: new Date("2026-08-10T16:00:00.000Z"),
    });
    expect(detectOverlappingEvents([left, right])).toHaveLength(0);
  });
});

describe("calendar permissions", () => {
  it("grants marketers calendar write access", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["calendar.create"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["calendar.reschedule"])).toBe(true);
  });

  it("restricts viewers to read-only", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["calendar.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["calendar.update"])).toBe(false);
  });
});
