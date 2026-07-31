import { z } from "zod";
import { LongFormContentType, LongFormExportFormat } from "@prisma/client";

export const createLongFormDocumentSchema = z.object({
  briefId: z.string(),
  title: z.string().trim().min(1).max(300).optional(),
  contentType: z.nativeEnum(LongFormContentType).optional(),
});

export const updateLongFormDocumentSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  slug: z.string().trim().max(200).optional(),
  metaDescription: z.string().trim().max(500).optional(),
});

export const updateSectionSchema = z.object({
  heading: z.string().trim().max(300).optional(),
  headingLevel: z.number().min(1).max(6).optional(),
  body: z.string().max(50000).optional(),
  isLocked: z.boolean().optional(),
  lockedRanges: z.array(z.object({ start: z.number(), end: z.number() })).optional(),
});

export const sectionActionSchema = z.object({
  action: z.enum([
    "SECTION_REGENERATE",
    "SHORTEN",
    "EXPAND",
    "CHANGE_TONE",
    "SIMPLIFY",
    "ADD_EXAMPLES",
    "REQUEST_EVIDENCE",
    "FULL_DOCUMENT",
  ]),
  tone: z.string().optional(),
  preserveLocked: z.boolean().default(true),
});

export const reviewDecisionSchema = z.object({
  stage: z.enum(["OUTLINE", "EVIDENCE", "SEO", "COMPLIANCE", "FINAL"]),
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
  decisionNote: z.string().trim().max(2000).optional(),
});

export const exportSchema = z.object({
  format: z.nativeEnum(LongFormExportFormat),
});

export const confirmOutlineSchema = z.object({
  confirmed: z.boolean(),
  changeNote: z.string().optional(),
});
