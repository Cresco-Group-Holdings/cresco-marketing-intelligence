import { z } from "zod";
import { SeoCompetitorType } from "@prisma/client";

export const createCompetitorSchema = z.object({
  name: z.string().trim().min(1).max(200),
  domain: z.string().trim().min(3).max(253),
  competitorType: z.nativeEnum(SeoCompetitorType).default("DIRECT"),
  notes: z.string().trim().max(5000).optional(),
});

export const updateCompetitorSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  competitorType: z.nativeEnum(SeoCompetitorType).optional(),
  notes: z.string().trim().max(5000).optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
});

export const addCompetitorKeywordSchema = z.object({
  keyword: z.string().trim().min(1).max(500),
  source: z.enum(["MANUAL", "CSV_IMPORT", "SERP_OBSERVATION", "PROVIDER"]),
  position: z.number().optional(),
  rankingUrl: z.string().url().optional(),
  provider: z.string().optional(),
  observedAt: z.string().datetime().optional(),
});

export const comparePagesSchema = z.object({
  brandPageId: z.string().optional(),
  competitorPageId: z.string().optional(),
  brandUrl: z.string().url().optional(),
  competitorUrl: z.string().url().optional(),
});

export const competitorListFiltersSchema = z.object({
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  competitorType: z.nativeEnum(SeoCompetitorType).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
