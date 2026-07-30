import { z } from "zod";

export const createRankProjectSchema = z.object({
  seoSiteId: z.string().min(1),
  name: z.string().min(1).max(200),
  keywordQuota: z.number().int().min(1).max(10000).optional(),
});

export const addTrackedKeywordSchema = z.object({
  keyword: z.string().min(1).max(500),
  keywordId: z.string().optional(),
  targetPageId: z.string().optional(),
  country: z.string().default("US"),
  language: z.string().default("en"),
  device: z.enum(["DESKTOP", "MOBILE", "TABLET", "ALL"]).default("ALL"),
  schedule: z.enum(["DAILY", "WEEKLY", "MANUAL"]).default("WEEKLY"),
  priority: z.number().int().min(1).max(100).default(50),
  tags: z.array(z.string()).default([]),
});

export const importObservationsSchema = z.object({
  trackedKeywordId: z.string().min(1),
  observations: z.array(z.object({
    source: z.enum(["SEARCH_CONSOLE", "RANK_PROVIDER", "MANUAL_IMPORT", "COMPLIANT_SERP"]),
    observedDate: z.string(),
    rank: z.number().int().min(1).max(100).nullable(),
    rankingUrl: z.string().optional().nullable(),
    impressions: z.number().int().optional().nullable(),
    clicks: z.number().int().optional().nullable(),
    ctr: z.number().optional().nullable(),
    providerMetadata: z.record(z.string(), z.unknown()).optional(),
  })),
});

export const convertRefreshSchema = z.object({
  recommendationId: z.string().min(1),
  workflowType: z.enum([
    "SEO_BRIEF",
    "CONTENT_TASK",
    "LONG_FORM_REVISION",
    "EXPERIMENT",
    "INTERNAL_LINK_PROPOSAL",
    "TECHNICAL_FIX",
  ]),
});
