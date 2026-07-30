import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";

const ingestionService = vi.hoisted(() => ({
  ingestBatch: vi.fn(),
}));
const propertyService = vi.hoisted(() => ({
  listProperties: vi.fn(),
  createProperty: vi.fn(),
}));
const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/tracking-ingestion-service", () => ({
  trackingIngestionService: ingestionService,
  trackingPropertyService: propertyService,
}));
vi.mock("@/lib/tenancy/guards", () => ({
  buildTenantContext,
}));
vi.mock("@/lib/auth/provisioning", () => ({
  ensureUserProfile: vi.fn(async () => ({
    authUserId: "tracking-route-user",
    email: "tracking-route@example.test",
    userProfileId: "profile-tracking",
  })),
  extractProviderMetadata: vi.fn(() => ({})),
}));

import { POST as postEvents } from "@/app/api/tracking/v1/events/route";
import { GET as getProperties } from "@/app/api/tracking/properties/route";

const originalAuth = process.env.ALLOW_TEST_AUTH;
const originalUser = process.env.TEST_AUTH_USER_ID;

function jsonRequest(path: string, body: unknown, headers?: Record<string, string>) {
  return new NextRequest(`https://app.test${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "https://crescogroup.uk",
      "user-agent": "Mozilla/5.0",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function getRequest(path: string) {
  return new NextRequest(`https://app.test${path}`);
}

describe("tracking API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOW_TEST_AUTH = "true";
    process.env.TEST_AUTH_USER_ID = "tracking-route-user";
    process.env.TEST_AUTH_EMAIL = "tracking-route@example.test";
    buildTenantContext.mockResolvedValue({
      userId: "tracking-route-user",
      userProfileId: "profile-tracking",
      organisationId: "org-tracking",
      organisationRole: OrganisationRole.OWNER,
    });
    ingestionService.ingestBatch.mockResolvedValue({ accepted: 1, results: [{ status: "accepted" }] });
    propertyService.listProperties.mockResolvedValue([]);
  });

  afterEach(() => {
    process.env.ALLOW_TEST_AUTH = originalAuth;
    process.env.TEST_AUTH_USER_ID = originalUser;
  });

  it("rejects invalid ingest payloads", async () => {
    const response = await postEvents(
      jsonRequest("/api/tracking/v1/events", { propertyId: "short", events: [] }),
    );
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it("accepts valid ingest payloads", async () => {
    const response = await postEvents(
      jsonRequest("/api/tracking/v1/events", {
        propertyId: "prop_1234567890ab",
        events: [
          {
            eventId: "evt-12345678",
            eventName: "page_view",
            occurredAt: new Date().toISOString(),
            anonymousId: "anon-12345678",
            consent: { ESSENTIAL: true, ANALYTICS: true },
          },
        ],
      }),
    );
    expect(response.status).toBe(200);
    expect(ingestionService.ingestBatch).toHaveBeenCalled();
  });

  it("rejects property routes without organisation context", async () => {
    const response = await getProperties(getRequest("/api/tracking/properties?brandId=brand-1"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("TENANT_CONTEXT_REQUIRED");
  });

  it("returns properties for authorised users", async () => {
    propertyService.listProperties.mockResolvedValue([{ id: "prop-1", name: "Cresco UK" }]);
    const response = await getProperties(
      getRequest("/api/tracking/properties?brandId=brand-1&organisationId=org-tracking"),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.items).toHaveLength(1);
  });
});
