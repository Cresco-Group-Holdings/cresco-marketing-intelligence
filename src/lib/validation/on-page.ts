import { z } from "zod";
import { OnPageSeoAuditSourceType, OnPageSeoComparisonType } from "@prisma/client";

export const createOnPageAuditSchema = z.object({
  sourceType: z.nativeEnum(OnPageSeoAuditSourceType),
  crawlPageId: z.string().optional(),
  pageSnapshotId: z.string().optional(),
  longFormDocumentId: z.string().optional(),
  briefId: z.string().optional(),
  url: z.string().url().optional(),
  targetKeywordId: z.string().optional(),
  keywordGroupId: z.string().optional(),
  clusterId: z.string().optional(),
});

export const overrideSchema = z.object({
  findingId: z.string().optional(),
  recommendationId: z.string().optional(),
  reason: z.string().trim().min(1).max(2000),
});

export const comparisonSchema = z.object({
  comparisonType: z.nativeEnum(OnPageSeoComparisonType),
  baselineVersionId: z.string().optional(),
  compareVersionId: z.string().optional(),
});

export const recommendationStatusSchema = z.object({
  recommendationId: z.string(),
  status: z.enum(["ACCEPTED", "REJECTED", "APPLIED", "DISMISSED"]),
});
