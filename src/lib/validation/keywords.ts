import { z } from "zod";
import { SeoKeywordIntentType, SeoKeywordPageRelationType, SeoKeywordStatus } from "@prisma/client";

export const keywordListFiltersSchema = z.object({
  status: z.nativeEnum(SeoKeywordStatus).optional(),
  intent: z.nativeEnum(SeoKeywordIntentType).optional(),
  language: z.string().optional(),
  country: z.string().optional(),
  siteId: z.string().optional(),
  search: z.string().optional(),
  tag: z.string().optional(),
  sourceType: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const createKeywordSchema = z.object({
  keyword: z.string().trim().min(1).max(500),
  language: z.string().trim().max(10).default("en"),
  country: z.string().trim().max(10).optional(),
  locale: z.string().trim().max(20).optional(),
  siteId: z.string().optional(),
  tags: z.array(z.string().trim().max(100)).max(20).optional(),
});

export const updateKeywordSchema = z.object({
  status: z.nativeEnum(SeoKeywordStatus).optional(),
  displayKeyword: z.string().trim().min(1).max(500).optional(),
  note: z.string().trim().max(2000).optional(),
});

export const intentOverrideSchema = z.object({
  intent: z.nativeEnum(SeoKeywordIntentType),
  note: z.string().trim().max(2000).optional(),
});

export const pageMappingSchema = z.object({
  pageId: z.string().optional(),
  intendedUrl: z.string().url().optional(),
  relationType: z.nativeEnum(SeoKeywordPageRelationType),
});

export const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  groupType: z.string().trim().max(50).default("topic"),
  keywordIds: z.array(z.string()).max(500).optional(),
});

export const bulkTagSchema = z.object({
  keywordIds: z.array(z.string()).min(1).max(500),
  tags: z.array(z.string().trim().min(1).max(100)).min(1).max(20),
});

export const keywordImportSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  csvContent: z.string().min(1),
  idempotencyKey: z.string().trim().min(8).max(200),
  siteId: z.string().optional(),
  provider: z.string().trim().max(100).default("CSV_IMPORT"),
  columnMappings: z
    .array(
      z.object({
        sourceColumn: z.string(),
        targetField: z.string(),
        isRequired: z.boolean().optional(),
      }),
    )
    .optional(),
});

export const aiSuggestionSchema = z.object({
  seedKeyword: z.string().trim().min(1).max(500),
  siteId: z.string().optional(),
  maxSuggestions: z.number().int().min(1).max(20).default(10),
});
