import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTenant,
  databaseSuiteEnabled,
  prisma,
  resetDatabase,
} from "./helpers/analytics-fixtures";

const suite = databaseSuiteEnabled ? describe : describe.skip;

suite("first-party tracking against a real database", () => {
  let tenantA: Awaited<ReturnType<typeof createTenant>>;
  let tenantB: Awaited<ReturnType<typeof createTenant>>;

  beforeEach(async () => {
    await resetDatabase();
    tenantA = await createTenant();
    tenantB = await createTenant();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function services() {
    const tracking = await import("@/server/services/tracking-ingestion-service");
    return {
      trackingPropertyService: tracking.trackingPropertyService,
      trackingIngestionService: tracking.trackingIngestionService,
    };
  }

  function baseEvent(overrides: Record<string, unknown> = {}) {
    return {
      eventId: `evt-${Math.random().toString(36).slice(2, 12)}`,
      eventName: "page_view",
      occurredAt: new Date().toISOString(),
      anonymousId: "anon-12345678",
      sessionId: "sess-12345678",
      pageUrl: "https://crescogroup.uk/",
      referrer: "https://google.com/",
      consent: { ESSENTIAL: true, ANALYTICS: true },
      ...overrides,
    };
  }

  it("applies tracking migrations and exposes core tables", async () => {
    const tables = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
        'TrackingProperty',
        'TrackingDomain',
        'TrackingIngestLog'
      )`,
    );
    expect(tables).toHaveLength(3);
  });

  it("ingests valid events into the marketing warehouse", async () => {
    const { trackingPropertyService, trackingIngestionService } = await services();

    const property = await trackingPropertyService.createProperty(
      tenantA.organisation.id,
      {
        brandId: tenantA.brand.id,
        name: "Cresco UK",
        domains: [
          {
            hostname: "crescogroup.uk",
            allowedOrigin: "https://crescogroup.uk",
          },
        ],
      },
      tenantA.context as never,
    );

    const result = await trackingIngestionService.ingestBatch(
      {
        propertyId: property.publicPropertyId,
        sdkVersion: "1.0.0",
        events: [baseEvent()],
      },
      {
        origin: "https://crescogroup.uk",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        clientIp: "203.0.113.10",
      },
    );

    expect(result.accepted).toBe(1);

    const event = await prisma.marketingEvent.findFirst({
      where: { brandId: tenantA.brand.id, eventName: "page_view" },
    });
    expect(event).toBeTruthy();
    expect(event?.provider).toBe("FIRST_PARTY");

    const session = await prisma.marketingSession.findFirst({
      where: { brandId: tenantA.brand.id, provider: "FIRST_PARTY" },
    });
    expect(session?.pageViewCount).toBe(1);
  });

  it("rejects events from unverified origins", async () => {
    const { trackingPropertyService, trackingIngestionService } = await services();

    const property = await trackingPropertyService.createProperty(
      tenantA.organisation.id,
      {
        brandId: tenantA.brand.id,
        name: "Cresco Grants",
        domains: [
          {
            hostname: "crescogrants.com",
            allowedOrigin: "https://crescogrants.com",
          },
        ],
      },
      tenantA.context as never,
    );

    await expect(
      trackingIngestionService.ingestBatch(
        {
          propertyId: property.publicPropertyId,
          events: [baseEvent()],
        },
        {
          origin: "https://evil.example",
          userAgent: "Mozilla/5.0",
          clientIp: "203.0.113.11",
        },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("suppresses analytics events when consent is absent in cookieless mode", async () => {
    const { trackingPropertyService, trackingIngestionService } = await services();

    const property = await trackingPropertyService.createProperty(
      tenantA.organisation.id,
      {
        brandId: tenantA.brand.id,
        name: "Cookieless",
        cookielessMode: true,
        domains: [
          {
            hostname: "app.crescogrants.com",
            allowedOrigin: "https://app.crescogrants.com",
          },
        ],
      },
      tenantA.context as never,
    );

    const result = await trackingIngestionService.ingestBatch(
      {
        propertyId: property.publicPropertyId,
        events: [baseEvent({ consent: { ESSENTIAL: true } })],
      },
      {
        origin: "https://app.crescogrants.com",
        userAgent: "Mozilla/5.0",
        clientIp: "203.0.113.12",
      },
    );

    expect(result.results[0]?.status).toBe("rejected");
  });

  it("deduplicates repeated event IDs", async () => {
    const { trackingPropertyService, trackingIngestionService } = await services();

    const property = await trackingPropertyService.createProperty(
      tenantA.organisation.id,
      {
        brandId: tenantA.brand.id,
        name: "Dedup",
        domains: [
          {
            hostname: "capitalcresco.com",
            allowedOrigin: "https://capitalcresco.com",
          },
        ],
      },
      tenantA.context as never,
    );

    const event = baseEvent({ eventId: "evt-dedup-12345678" });
    const context = {
      origin: "https://capitalcresco.com",
      userAgent: "Mozilla/5.0",
      clientIp: "203.0.113.13",
    };

    await trackingIngestionService.ingestBatch(
      { propertyId: property.publicPropertyId, events: [event] },
      context,
    );
    const second = await trackingIngestionService.ingestBatch(
      { propertyId: property.publicPropertyId, events: [event] },
      context,
    );

    expect(second.results[0]?.duplicate).toBe(true);
  });

  it("links anonymous visitors to authenticated users", async () => {
    const { trackingPropertyService, trackingIngestionService } = await services();

    const property = await trackingPropertyService.createProperty(
      tenantA.organisation.id,
      {
        brandId: tenantA.brand.id,
        name: "Identity",
        domains: [
          {
            hostname: "app.capitalcresco.com",
            allowedOrigin: "https://app.capitalcresco.com",
          },
        ],
      },
      tenantA.context as never,
    );

    const context = {
      origin: "https://app.capitalcresco.com",
      userAgent: "Mozilla/5.0",
      clientIp: "203.0.113.14",
    };

    await trackingIngestionService.ingestBatch(
      {
        propertyId: property.publicPropertyId,
        events: [baseEvent({ eventId: "evt-anon-12345678", userId: undefined })],
      },
      context,
    );

    await trackingIngestionService.ingestBatch(
      {
        propertyId: property.publicPropertyId,
        events: [
          baseEvent({
            eventId: "evt-login-12345678",
            eventName: "login_complete",
            userId: "user-42",
          }),
        ],
      },
      context,
    );

    const link = await prisma.marketingIdentityLink.findFirst({
      where: { brandId: tenantA.brand.id, status: "CONFIRMED" },
    });
    expect(link).toBeTruthy();
  });

  it("isolates tracking data across tenants", async () => {
    const { trackingPropertyService } = await services();

    const propertyA = await trackingPropertyService.createProperty(
      tenantA.organisation.id,
      { brandId: tenantA.brand.id, name: "Tenant A" },
      tenantA.context as never,
    );

    const propertyB = await trackingPropertyService.createProperty(
      tenantB.organisation.id,
      { brandId: tenantB.brand.id, name: "Tenant B" },
      tenantB.context as never,
    );

    const listedA = await trackingPropertyService.listProperties(
      tenantA.brand.id,
      tenantA.organisation.id,
      tenantA.context as never,
    );
    const listedB = await trackingPropertyService.listProperties(
      tenantB.brand.id,
      tenantB.organisation.id,
      tenantB.context as never,
    );

    expect(listedA.some((item) => item.id === propertyA.id)).toBe(true);
    expect(listedA.some((item) => item.id === propertyB.id)).toBe(false);
    expect(listedB.some((item) => item.id === propertyB.id)).toBe(true);
  });
});
