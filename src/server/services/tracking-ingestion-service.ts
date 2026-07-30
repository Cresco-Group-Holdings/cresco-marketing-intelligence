import { randomUUID } from "node:crypto";
import type { Prisma, TrackingProperty } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { evaluateBotSignals } from "@/lib/tracking/bot-filter";
import { isEventAllowedByConsent, parseConsentState } from "@/lib/tracking/consent";
import { TRACKING_SDK_VERSION } from "@/lib/tracking/constants";
import {
  generatePublicPropertyId,
  generateTrackingApiKey,
} from "@/lib/tracking/api-key";
import { deviceCategoryFromUserAgent, shouldStartNewSession } from "@/lib/tracking/session";
import {
  hostnameFromOrigin,
  isValidEventName,
  normaliseOrigin,
  sanitiseUrl,
  sanitizeEventProperties,
} from "@/lib/tracking/payload-sanitize";
import type { TrackingEventInput, TrackingIngestInput } from "@/lib/validation/tracking";
import { marketingWarehouseRegistryService } from "@/server/services/marketing-warehouse-registry-service";
import { brandService } from "@/server/services/workspace-service";
import type { TenantContext } from "@/lib/tenancy/context";

type IngestContext = {
  origin: string | null;
  userAgent: string | null;
  clientIp: string;
};

export const trackingPropertyService = {
  async createProperty(
    organisationId: string,
    input: {
      brandId: string;
      name: string;
      defaultTimezone?: string;
      reportingCurrency?: string;
      sessionTimeoutMinutes?: number;
      cookielessMode?: boolean;
      domains?: Array<{
        hostname: string;
        allowedOrigin: string;
        environmentType?: "PRODUCTION" | "STAGING" | "DEVELOPMENT";
      }>;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(input.brandId, organisationId, context);
    const publicPropertyId = generatePublicPropertyId();

    const property = await prisma.$transaction(async (tx) => {
      const created = await tx.trackingProperty.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId: input.brandId,
          name: input.name,
          publicPropertyId,
          defaultTimezone: input.defaultTimezone ?? "UTC",
          reportingCurrency: input.reportingCurrency ?? "GBP",
          sessionTimeoutMinutes: input.sessionTimeoutMinutes ?? 30,
          cookielessMode: input.cookielessMode ?? false,
        },
      });

      await tx.trackingEnvironment.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId: input.brandId,
          trackingPropertyId: created.id,
          name: "Production",
          environmentType: "PRODUCTION",
          isDefault: true,
        },
      });

      if (input.domains?.length) {
        for (const domain of input.domains) {
          await tx.trackingDomain.create({
            data: {
              organisationId,
              projectId: brand.projectId,
              brandId: input.brandId,
              trackingPropertyId: created.id,
              hostname: domain.hostname.toLowerCase(),
              allowedOrigin: normaliseOrigin(domain.allowedOrigin) ?? domain.allowedOrigin,
              environmentType: domain.environmentType ?? "PRODUCTION",
              verificationStatus: "VERIFIED",
              verificationToken: randomUUID(),
            },
          });
        }
      }

      return created;
    });

    await marketingWarehouseRegistryService.ensureSourceAccount({
      brandId: input.brandId,
      organisationId,
      projectId: brand.projectId,
      provider: "FIRST_PARTY",
      displayName: `First-party: ${input.name}`,
      externalAccountId: property.publicPropertyId,
    });

    return property;
  },

  async listProperties(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.trackingProperty.findMany({
      where: { organisationId, brandId },
      include: {
        domains: true,
        environments: true,
        installations: { orderBy: { lastSeenAt: "desc" }, take: 5 },
        _count: { select: { ingestLogs: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  },

  async createApiKey(
    organisationId: string,
    input: { propertyId: string; name: string },
    context: TenantContext,
  ) {
    const property = await prisma.trackingProperty.findFirst({
      where: { id: input.propertyId, organisationId },
    });
    if (!property) {
      throw new AppError("NOT_FOUND", "Tracking property was not found.");
    }
    await brandService.getById(property.brandId, organisationId, context);

    const { key, prefix, hash } = generateTrackingApiKey();
    const record = await prisma.trackingApiKey.create({
      data: {
        organisationId,
        trackingPropertyId: property.id,
        name: input.name,
        keyPrefix: prefix,
        keyHash: hash,
      },
    });

    return { apiKey: key, record };
  },

  async resolveByPublicId(publicPropertyId: string): Promise<
    | (TrackingProperty & {
        domains: Array<{ allowedOrigin: string; hostname: string; verificationStatus: string }>;
      })
    | null
  > {
    return prisma.trackingProperty.findFirst({
      where: { publicPropertyId, status: "ACTIVE" },
      include: { domains: true },
    });
  },

  validateOrigin(
    property: { domains: Array<{ allowedOrigin: string; verificationStatus: string }> },
    origin: string | null,
  ): boolean {
    const normalised = normaliseOrigin(origin);
    if (!normalised) return false;
    return property.domains.some(
      (domain) =>
        domain.verificationStatus === "VERIFIED" && domain.allowedOrigin === normalised,
    );
  },
};

export const trackingIngestionService = {
  async ingestBatch(input: TrackingIngestInput, context: IngestContext) {
    const property = await trackingPropertyService.resolveByPublicId(input.propertyId);
    if (!property) {
      throw new AppError("NOT_FOUND", "Tracking property was not found.");
    }

    if (!trackingPropertyService.validateOrigin(property, context.origin)) {
      throw new AppError("FORBIDDEN", "Origin is not allowed for this property.");
    }

    const account = await marketingWarehouseRegistryService.ensureSourceAccount({
      brandId: property.brandId,
      organisationId: property.organisationId,
      projectId: property.projectId,
      provider: "FIRST_PARTY",
      externalAccountId: property.publicPropertyId,
      displayName: property.name,
    });

    const results = [];
    const seenEventIds = new Set<string>();

    for (const event of input.events) {
      if (seenEventIds.has(event.eventId)) {
        results.push({ eventId: event.eventId, status: "quarantined", reason: "duplicate_in_batch" });
        continue;
      }
      seenEventIds.add(event.eventId);

      const result = await this.ingestEvent(property, account.id, event, context, input.sdkVersion);
      results.push(result);
    }

    const installation = await prisma.trackingInstallation.findFirst({
      where: {
        trackingPropertyId: property.id,
        platform: "browser",
        environmentType: "PRODUCTION",
      },
    });
    if (installation) {
      await prisma.trackingInstallation.update({
        where: { id: installation.id },
        data: {
          sdkVersion: input.sdkVersion ?? TRACKING_SDK_VERSION,
          status: "ACTIVE",
          lastSeenAt: new Date(),
        },
      });
    } else {
      await prisma.trackingInstallation.create({
        data: {
          organisationId: property.organisationId,
          projectId: property.projectId,
          brandId: property.brandId,
          trackingPropertyId: property.id,
          platform: "browser",
          sdkVersion: input.sdkVersion ?? TRACKING_SDK_VERSION,
          environmentType: "PRODUCTION",
          status: "ACTIVE",
          lastSeenAt: new Date(),
        },
      });
    }

    const hostname = context.origin ? hostnameFromOrigin(context.origin) : null;
    if (hostname) {
      const domain = await prisma.trackingDomain.findFirst({
        where: { trackingPropertyId: property.id, hostname },
      });
      if (domain) {
        await prisma.trackingDomain.update({
          where: { id: domain.id },
          data: {
            lastSeenAt: new Date(),
            ...(domain.firstSeenAt ? {} : { firstSeenAt: new Date() }),
          },
        });
      }
    }

    return { accepted: results.filter((r) => r.status === "accepted").length, results };
  },

  async ingestEvent(
    property: TrackingProperty & { domains: Array<{ allowedOrigin: string }> },
    sourceAccountId: string,
    event: TrackingEventInput,
    context: IngestContext,
    sdkVersion?: string,
  ) {
    const idempotencyKey = `track:${property.publicPropertyId}:${event.eventId}`;

    const existingLog = await prisma.trackingIngestLog.findUnique({
      where: { idempotencyKey },
    });
    if (existingLog) {
      return { eventId: event.eventId, status: existingLog.status.toLowerCase(), duplicate: true };
    }

    if (!isValidEventName(event.eventName)) {
      await this.writeIngestLog(property, {
        idempotencyKey,
        eventName: event.eventName,
        status: "REJECTED",
        origin: context.origin,
        userAgent: context.userAgent,
        quarantineReason: "invalid_event_name",
        clientTimestamp: new Date(event.occurredAt),
      });
      return { eventId: event.eventId, status: "rejected", reason: "invalid_event_name" };
    }

    const consent = parseConsentState(event.consent);
    if (!isEventAllowedByConsent(event.eventName, consent, property.cookielessMode)) {
      await this.writeIngestLog(property, {
        idempotencyKey,
        eventName: event.eventName,
        status: "REJECTED",
        origin: context.origin,
        userAgent: context.userAgent,
        quarantineReason: "consent_suppressed",
        clientTimestamp: new Date(event.occurredAt),
        payloadSummary: { consent },
      });
      return { eventId: event.eventId, status: "rejected", reason: "consent_suppressed" };
    }

    const bot = evaluateBotSignals({
      userAgent: context.userAgent,
      origin: context.origin,
      isInternalTraffic: context.userAgent?.includes("CrescoInternalMonitor") ?? false,
    });

    const properties = sanitizeEventProperties(event.properties);
    const pageUrl = sanitiseUrl(event.pageUrl);
    const referrer = sanitiseUrl(event.referrer);

    if (bot.quarantine) {
      await this.writeIngestLog(property, {
        idempotencyKey,
        eventName: event.eventName,
        status: "QUARANTINED",
        origin: context.origin,
        userAgent: context.userAgent,
        quarantineReason: bot.reason,
        clientTimestamp: new Date(event.occurredAt),
        payloadSummary: { properties },
      });
      return { eventId: event.eventId, status: "quarantined", reason: bot.reason };
    }

    const occurredAt = new Date(event.occurredAt);
    const providerSessionId = event.sessionId ?? `sess_${event.anonymousId}`;
    const deviceCategory = deviceCategoryFromUserAgent(context.userAgent);

    const session = await this.resolveSession({
      property,
      sourceAccountId,
      providerSessionId,
      anonymousId: event.anonymousId,
      occurredAt,
      pageUrl,
      referrer,
      utmSource: event.utmSource,
      utmMedium: event.utmMedium,
      utmCampaign: event.utmCampaign,
      utmTerm: event.utmTerm,
      utmContent: event.utmContent,
      consent,
      deviceCategory,
      eventName: event.eventName,
    });

    let identityId: string | undefined;
    if (event.userId) {
      const identity = await prisma.marketingIdentity.upsert({
        where: {
          brandId_identityType_identityValue: {
            brandId: property.brandId,
            identityType: "USER_ID",
            identityValue: event.userId,
          },
        },
        create: {
          organisationId: property.organisationId,
          projectId: property.projectId,
          brandId: property.brandId,
          identityType: "USER_ID",
          identityValue: event.userId,
          firstSeenAt: occurredAt,
          lastSeenAt: occurredAt,
        },
        update: { lastSeenAt: occurredAt },
      });
      identityId = identity.id;

      const anonymous = await prisma.marketingIdentity.upsert({
        where: {
          brandId_identityType_identityValue: {
            brandId: property.brandId,
            identityType: "ANONYMOUS_ID",
            identityValue: event.anonymousId,
          },
        },
        create: {
          organisationId: property.organisationId,
          projectId: property.projectId,
          brandId: property.brandId,
          identityType: "ANONYMOUS_ID",
          identityValue: event.anonymousId,
          firstSeenAt: occurredAt,
          lastSeenAt: occurredAt,
        },
        update: { lastSeenAt: occurredAt },
      });

      await prisma.marketingIdentityLink.upsert({
        where: {
          fromIdentityId_toIdentityId: {
            fromIdentityId: anonymous.id,
            toIdentityId: identity.id,
          },
        },
        create: {
          organisationId: property.organisationId,
          projectId: property.projectId,
          brandId: property.brandId,
          fromIdentityId: anonymous.id,
          toIdentityId: identity.id,
          linkMethod: "USER_CONFIRMED",
          status: "CONFIRMED",
          confidence: 1,
          confirmedAt: occurredAt,
        },
        update: { status: "CONFIRMED", confirmedAt: occurredAt },
      });
    } else {
      const anonymous = await prisma.marketingIdentity.upsert({
        where: {
          brandId_identityType_identityValue: {
            brandId: property.brandId,
            identityType: "ANONYMOUS_ID",
            identityValue: event.anonymousId,
          },
        },
        create: {
          organisationId: property.organisationId,
          projectId: property.projectId,
          brandId: property.brandId,
          identityType: "ANONYMOUS_ID",
          identityValue: event.anonymousId,
          firstSeenAt: occurredAt,
          lastSeenAt: occurredAt,
        },
        update: { lastSeenAt: occurredAt },
      });
      identityId = anonymous.id;
    }

    const marketingEvent = await prisma.marketingEvent.upsert({
      where: { idempotencyKey },
      create: {
        organisationId: property.organisationId,
        projectId: property.projectId,
        brandId: property.brandId,
        marketingDataSourceAccountId: sourceAccountId,
        provider: "FIRST_PARTY",
        source: "FIRST_PARTY",
        providerEventId: event.eventId,
        eventName: event.eventName,
        occurredAt,
        sessionId: session.id,
        identityId,
        properties: {
          ...properties,
          pageUrl,
          referrer,
          sdkVersion: sdkVersion ?? TRACKING_SDK_VERSION,
        } as Prisma.InputJsonValue,
        idempotencyKey,
      },
      update: {
        occurredAt,
        properties: {
          ...properties,
          pageUrl,
          referrer,
          sdkVersion: sdkVersion ?? TRACKING_SDK_VERSION,
        } as Prisma.InputJsonValue,
      },
    });

    await this.writeIngestLog(property, {
      idempotencyKey,
      eventName: event.eventName,
      status: "ACCEPTED",
      origin: context.origin,
      userAgent: context.userAgent,
      clientTimestamp: occurredAt,
      marketingEventId: marketingEvent.id,
      payloadSummary: { properties, sessionId: session.id },
    });

    return { eventId: event.eventId, status: "accepted", marketingEventId: marketingEvent.id };
  },

  async resolveSession(input: {
    property: TrackingProperty;
    sourceAccountId: string;
    providerSessionId: string;
    anonymousId: string;
    occurredAt: Date;
    pageUrl?: string;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
    consent: ReturnType<typeof parseConsentState>;
    deviceCategory: string;
    eventName: string;
  }) {
    const existing = await prisma.marketingSession.findUnique({
      where: {
        brandId_provider_providerSessionId: {
          brandId: input.property.brandId,
          provider: "FIRST_PARTY",
          providerSessionId: input.providerSessionId,
        },
      },
    });

    if (
      existing &&
      !shouldStartNewSession({
        lastActivityAt: existing.updatedAt,
        now: input.occurredAt,
        timeoutMinutes: input.property.sessionTimeoutMinutes,
        previousCampaign: existing.utmCampaign,
        nextCampaign: input.utmCampaign,
        campaignChangeStartsSession: false,
      })
    ) {
      return prisma.marketingSession.update({
        where: { id: existing.id },
        data: {
          endedAt: input.occurredAt,
          exitPage: input.pageUrl,
          eventCount: { increment: 1 },
          pageViewCount: input.eventName === "page_view" ? { increment: 1 } : undefined,
          consentState: input.consent as Prisma.InputJsonValue,
          updatedAt: input.occurredAt,
        },
      });
    }

    return prisma.marketingSession.upsert({
      where: {
        brandId_provider_providerSessionId: {
          brandId: input.property.brandId,
          provider: "FIRST_PARTY",
          providerSessionId: input.providerSessionId,
        },
      },
      create: {
        organisationId: input.property.organisationId,
        projectId: input.property.projectId,
        brandId: input.property.brandId,
        marketingDataSourceAccountId: input.sourceAccountId,
        provider: "FIRST_PARTY",
        providerSessionId: input.providerSessionId,
        startedAt: input.occurredAt,
        endedAt: input.occurredAt,
        landingPage: input.pageUrl,
        exitPage: input.pageUrl,
        referrer: input.referrer,
        utmSource: input.utmSource,
        utmMedium: input.utmMedium,
        utmCampaign: input.utmCampaign,
        utmTerm: input.utmTerm,
        utmContent: input.utmContent,
        source: input.utmSource,
        medium: input.utmMedium,
        campaign: input.utmCampaign,
        deviceCategory: input.deviceCategory,
        consentState: input.consent as Prisma.InputJsonValue,
        pageViewCount: input.eventName === "page_view" ? 1 : 0,
        eventCount: 1,
      },
      update: {
        endedAt: input.occurredAt,
        exitPage: input.pageUrl,
        eventCount: { increment: 1 },
        pageViewCount: input.eventName === "page_view" ? { increment: 1 } : undefined,
        consentState: input.consent as Prisma.InputJsonValue,
      },
    });
  },

  async writeIngestLog(
    property: TrackingProperty,
    input: {
      idempotencyKey: string;
      eventName: string;
      status: "ACCEPTED" | "QUARANTINED" | "REJECTED";
      origin: string | null;
      userAgent: string | null;
      quarantineReason?: string;
      clientTimestamp?: Date;
      marketingEventId?: string;
      payloadSummary?: Record<string, unknown>;
    },
  ) {
    return prisma.trackingIngestLog.create({
      data: {
        organisationId: property.organisationId,
        projectId: property.projectId,
        brandId: property.brandId,
        trackingPropertyId: property.id,
        idempotencyKey: input.idempotencyKey,
        eventName: input.eventName,
        status: input.status,
        origin: input.origin ?? undefined,
        userAgent: input.userAgent ?? undefined,
        quarantineReason: input.quarantineReason,
        clientTimestamp: input.clientTimestamp,
        marketingEventId: input.marketingEventId,
        payloadSummary: input.payloadSummary as Prisma.InputJsonValue,
      },
    });
  },
};
