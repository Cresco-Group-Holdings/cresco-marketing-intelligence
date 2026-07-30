import { z } from "zod";
import { STANDARD_TRACKING_EVENTS, TRACKING_MAX_BATCH_SIZE } from "@/lib/tracking/constants";

const consentSchema = z
  .object({
    ESSENTIAL: z.boolean().optional(),
    ANALYTICS: z.boolean().optional(),
    MARKETING: z.boolean().optional(),
    PERSONALISATION: z.boolean().optional(),
  })
  .optional();

export const trackingEventSchema = z.object({
  eventId: z.string().min(8).max(128),
  eventName: z.string().min(1).max(64),
  occurredAt: z.string().datetime(),
  sessionId: z.string().min(8).max(128).optional(),
  anonymousId: z.string().min(8).max(128),
  userId: z.string().min(1).max(128).optional(),
  pageUrl: z.string().max(2048).optional(),
  referrer: z.string().max(2048).optional(),
  utmSource: z.string().max(128).optional(),
  utmMedium: z.string().max(128).optional(),
  utmCampaign: z.string().max(128).optional(),
  utmTerm: z.string().max(128).optional(),
  utmContent: z.string().max(128).optional(),
  consent: consentSchema,
  properties: z.record(z.string(), z.unknown()).optional(),
});

export const trackingIngestSchema = z.object({
  propertyId: z.string().min(8).max(64),
  sdkVersion: z.string().max(32).optional(),
  events: z.array(trackingEventSchema).min(1).max(TRACKING_MAX_BATCH_SIZE),
});

export const trackingServerEventSchema = z.object({
  propertyId: z.string().min(8).max(64),
  eventName: z.enum(STANDARD_TRACKING_EVENTS as unknown as [string, ...string[]]),
  occurredAt: z.string().datetime(),
  userId: z.string().min(1).max(128).optional(),
  leadId: z.string().min(1).max(128).optional(),
  customerId: z.string().min(1).max(128).optional(),
  idempotencyKey: z.string().min(8).max(128),
  properties: z.record(z.string(), z.unknown()).optional(),
});

export const trackingPropertyCreateSchema = z.object({
  brandId: z.string().min(1),
  name: z.string().min(1).max(120),
  defaultTimezone: z.string().default("UTC"),
  reportingCurrency: z.string().length(3).default("GBP"),
  sessionTimeoutMinutes: z.number().int().min(5).max(240).default(30),
  cookielessMode: z.boolean().default(false),
  domains: z
    .array(
      z.object({
        hostname: z.string().min(1),
        allowedOrigin: z.string().url(),
        environmentType: z.enum(["PRODUCTION", "STAGING", "DEVELOPMENT"]).default("PRODUCTION"),
      }),
    )
    .optional(),
});

export type TrackingIngestInput = z.infer<typeof trackingIngestSchema>;
export type TrackingEventInput = z.infer<typeof trackingEventSchema>;
export type TrackingServerEventInput = z.infer<typeof trackingServerEventSchema>;
