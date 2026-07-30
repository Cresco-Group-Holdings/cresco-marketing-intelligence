import { z } from "zod";
import { SeoDomainVerificationMethod, SeoSiteStatus } from "@prisma/client";
import { SEO_CRAWL_DEFAULTS } from "@/lib/seo/constants";

export const createSeoSiteSchema = z.object({
  name: z.string().trim().min(1).max(200),
  primaryDomain: z
    .string()
    .trim()
    .min(3)
    .max(253)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i, "Invalid domain"),
  preferredProtocol: z.enum(["http", "https"]).default("https"),
  defaultLocale: z.string().trim().max(20).optional(),
  defaultTimezone: z.string().trim().max(60).optional(),
  trackingPropertyId: z.string().optional(),
});

export const updateSeoSiteSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  status: z.nativeEnum(SeoSiteStatus).optional(),
  defaultLocale: z.string().trim().max(20).optional(),
  defaultTimezone: z.string().trim().max(60).optional(),
});

export const verifyDomainSchema = z.object({
  method: z.nativeEnum(SeoDomainVerificationMethod),
  hostname: z.string().trim().min(3).max(253).optional(),
});

export const crawlConfigSchema = z.object({
  startUrls: z.array(z.string().url()).max(20).optional(),
  allowedDomains: z.array(z.string().min(3).max(253)).max(20).optional(),
  allowedSubdomains: z.boolean().optional(),
  includeRules: z.array(z.string().max(200)).max(50).optional(),
  excludeRules: z.array(z.string().max(200)).max(50).optional(),
  maxPages: z.number().int().min(1).max(10_000).optional(),
  maxDepth: z.number().int().min(0).max(20).optional(),
  requestConcurrency: z.number().int().min(1).max(10).optional(),
  requestDelayMs: z.number().int().min(0).max(10_000).optional(),
  requestTimeoutMs: z.number().int().min(1000).max(60_000).optional(),
  redirectLimit: z.number().int().min(0).max(20).optional(),
  userAgent: z.string().trim().min(5).max(200).optional(),
  respectRobotsTxt: z.boolean().optional(),
  followCanonical: z.boolean().optional(),
  crawlSchedule: z.string().max(100).optional(),
});

export const startCrawlSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(200).optional(),
});

export const issueStatusSchema = z.object({
  status: z.enum(["OPEN", "ACKNOWLEDGED", "FIXED", "IGNORED", "FALSE_POSITIVE", "REOPENED"]),
  note: z.string().trim().max(2000).optional(),
});

export const DEFAULT_CRAWL_CONFIG = {
  startUrls: [] as string[],
  allowedDomains: [] as string[],
  allowedSubdomains: true,
  includeRules: [] as string[],
  excludeRules: [] as string[],
  maxPages: SEO_CRAWL_DEFAULTS.maxPages,
  maxDepth: SEO_CRAWL_DEFAULTS.maxDepth,
  requestConcurrency: SEO_CRAWL_DEFAULTS.requestConcurrency,
  requestDelayMs: SEO_CRAWL_DEFAULTS.requestDelayMs,
  requestTimeoutMs: SEO_CRAWL_DEFAULTS.requestTimeoutMs,
  redirectLimit: SEO_CRAWL_DEFAULTS.redirectLimit,
  userAgent: SEO_CRAWL_DEFAULTS.userAgent,
  respectRobotsTxt: SEO_CRAWL_DEFAULTS.respectRobotsTxt,
  followCanonical: SEO_CRAWL_DEFAULTS.followCanonical,
  ignoredExtensions: [...SEO_CRAWL_DEFAULTS.ignoredExtensions],
};
