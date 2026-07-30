import { z } from "zod";
import { SeoContentFormatType } from "@prisma/client";

export const createBriefSchema = z.object({
  workingTitle: z.string().trim().min(1).max(300).optional(),
  contentType: z.nativeEnum(SeoContentFormatType).optional(),
  primaryKeywordId: z.string().optional(),
  clusterId: z.string().optional(),
  targetPageId: z.string().optional(),
  audience: z.string().trim().max(500).optional(),
  offer: z.string().trim().max(500).optional(),
  cta: z.string().trim().max(300).optional(),
  secondaryKeywordIds: z.array(z.string()).optional(),
});

export const generateBriefSchema = z.object({
  briefId: z.string(),
});

export const updateBriefSchema = z.object({
  workingTitle: z.string().trim().min(1).max(300).optional(),
  audience: z.string().trim().max(500).optional(),
  offer: z.string().trim().max(500).optional(),
  cta: z.string().trim().max(300).optional(),
});

export const briefCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
  versionId: z.string().optional(),
});

export const briefApprovalSchema = z.object({
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
  decisionNote: z.string().trim().max(2000).optional(),
  versionId: z.string().optional(),
});
