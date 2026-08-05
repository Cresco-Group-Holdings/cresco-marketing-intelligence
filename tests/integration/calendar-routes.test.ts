import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";

const calendarService = vi.hoisted(() => ({
  listEvents: vi.fn(),
  createManualEvent: vi.fn(),
  getEvent: vi.fn(),
  updateEvent: vi.fn(),
  rescheduleEvent: vi.fn(),
  cancelEvent: vi.fn(),
  listUpcoming: vi.fn(),
  listUnscheduledContent: vi.fn(),
  listOverduePublications: vi.fn(),
  detectConflicts: vi.fn(),
}));

const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/calendar-service", () => ({ calendarService }));
vi.mock("@/lib/tenancy/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenancy/guards")>();
  return { ...actual, buildTenantContext };
});
vi.mock("@/lib/auth/provisioning", () => ({
  ensureUserProfile: vi.fn().mockResolvedValue({ authUserId: "test-auth", userProfileId: "profile-1" }),
  extractProviderMetadata: vi.fn().mockReturnValue({}),
}));

import { GET, POST } from "@/app/api/calendar/events/route";
import { PATCH } from "@/app/api/calendar/events/[eventId]/route";

const organisationId = "org-cal-1";
const eventId = "evt-cal-1";

describe("calendar routes authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOW_TEST_AUTH = "true";
    process.env.TEST_AUTH_USER_ID = "test-auth";
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.OWNER,
    });
    calendarService.listEvents.mockResolvedValue({ items: [], nextCursor: null });
    calendarService.createManualEvent.mockResolvedValue({ id: eventId, version: 1 });
    calendarService.getEvent.mockResolvedValue({ id: eventId, version: 1 });
    calendarService.updateEvent.mockResolvedValue({ id: eventId, version: 2 });
    calendarService.rescheduleEvent.mockResolvedValue({ id: eventId, version: 2 });
  });

  afterEach(() => {
    delete process.env.ALLOW_TEST_AUTH;
    delete process.env.TEST_AUTH_USER_ID;
  });

  it("allows marketers to list events", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });

    const response = await GET(
      new NextRequest(
        `https://app.test/api/calendar/events?organisationId=${organisationId}&from=2026-08-01T00:00:00.000Z&to=2026-08-31T23:59:59.000Z`,
      ),
    );
    expect(response.status).toBe(200);
    expect(calendarService.listEvents).toHaveBeenCalled();
  });

  it("rejects viewers creating events", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.VIEWER,
    });

    const response = await POST(
      new NextRequest(`https://app.test/api/calendar/events?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brandId: "brand-1",
          title: "Manual event",
          startsAt: "2026-08-10T10:00:00.000Z",
        }),
      }),
    );
    expect(response.status).toBe(403);
  });

  it("reschedules events with version for marketers", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });

    const response = await PATCH(
      new NextRequest(`https://app.test/api/calendar/events/${eventId}?organisationId=${organisationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startsAt: "2026-08-11T10:00:00.000Z",
          version: 1,
        }),
      }),
      { params: Promise.resolve({ eventId }) },
    );
    expect(response.status).toBe(200);
    expect(calendarService.rescheduleEvent).toHaveBeenCalled();
  });

  it("scopes list calls to organisation tenant context", async () => {
    await GET(
      new NextRequest(
        `https://app.test/api/calendar/events?organisationId=${organisationId}&from=2026-08-01T00:00:00.000Z&to=2026-08-31T23:59:59.000Z&brandId=brand-1`,
      ),
    );
    expect(calendarService.listEvents).toHaveBeenCalledWith(
      organisationId,
      expect.objectContaining({ brandId: "brand-1" }),
      expect.any(Object),
    );
  });
});
