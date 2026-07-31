import { z } from "zod";
import {
  SeoContentFormatType,
  SeoFunnelStage,
  SeoRoadmapStatus,
  SeoTopicClusterStatus,
} from "@prisma/client";

export const createTopicSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  funnelStage: z.nativeEnum(SeoFunnelStage).optional(),
});

export const createClusterSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).optional(),
  topicId: z.string().optional(),
});

export const updateClusterSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).optional(),
  status: z.nativeEnum(SeoTopicClusterStatus).optional(),
  isConfirmed: z.boolean().optional(),
});

export const addClusterMemberSchema = z.object({
  memberType: z.enum(["KEYWORD", "PAGE", "ENTITY", "COMPETITOR_GAP"]),
  keywordId: z.string().optional(),
  pageId: z.string().optional(),
  entityId: z.string().optional(),
  contentGapId: z.string().optional(),
  isLocked: z.boolean().optional(),
});

export const runClusteringSchema = z.object({
  includeCompetitorGaps: z.boolean().default(true),
  includeSemanticExtension: z.boolean().default(true),
});

export const createPillarSchema = z.object({
  clusterId: z.string(),
  title: z.string().trim().min(1).max(300),
  formatType: z.nativeEnum(SeoContentFormatType).default("PILLAR"),
  targetUrl: z.string().url().optional(),
  existingPageId: z.string().optional(),
  funnelStage: z.nativeEnum(SeoFunnelStage).optional(),
});

export const createSupportingSchema = z.object({
  clusterId: z.string(),
  pillarPageId: z.string().optional(),
  title: z.string().trim().min(1).max(300),
  formatType: z.nativeEnum(SeoContentFormatType).default("SUPPORTING_ARTICLE"),
  sequenceOrder: z.number().int().min(0).default(0),
  funnelStage: z.nativeEnum(SeoFunnelStage).optional(),
});

export const updateRoadmapSchema = z.object({
  itemType: z.enum(["pillar", "supporting", "gap_plan"]),
  itemId: z.string(),
  roadmapStatus: z.nativeEnum(SeoRoadmapStatus),
});

export const createStrategySchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const comparePagesSchema = z.object({
  clusterId: z.string().optional(),
});
