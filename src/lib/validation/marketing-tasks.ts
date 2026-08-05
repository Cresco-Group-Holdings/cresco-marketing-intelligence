import { z } from "zod";
import {
  MarketingTaskPriority,
  MarketingTaskStatus,
  MarketingTaskType,
} from "@prisma/client";

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const marketingTaskListQuerySchema = z.object({
  status: z.nativeEnum(MarketingTaskStatus).optional(),
  type: z.nativeEnum(MarketingTaskType).optional(),
  priority: z.nativeEnum(MarketingTaskPriority).optional(),
  assigneeUserId: z.string().optional(),
  campaignId: z.string().optional(),
  sourceEntityType: z.string().optional(),
  sourceEntityId: z.string().optional(),
  overdueOnly: z.coerce.boolean().optional(),
  blockedOnly: z.coerce.boolean().optional(),
  myTasks: z.coerce.boolean().optional(),
  search: optionalTrimmed(200),
});

export const marketingTaskCreateSchema = z.object({
  title: trimmed(300),
  description: optionalTrimmed(10000),
  type: z.nativeEnum(MarketingTaskType).optional(),
  status: z.nativeEnum(MarketingTaskStatus).optional(),
  priority: z.nativeEnum(MarketingTaskPriority).optional(),
  assigneeUserId: z.string().optional().nullable(),
  campaignId: z.string().optional(),
  sourceEntityType: z.string().optional(),
  sourceEntityId: z.string().optional(),
  startAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional().nullable(),
  templateId: z.string().optional(),
  checklistItems: z.array(trimmed(500)).max(30).optional(),
  watcherUserIds: z.array(z.string()).max(20).optional(),
});

export const marketingTaskUpdateSchema = marketingTaskCreateSchema
  .partial()
  .extend({
    expectedVersion: z.number().int().positive().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const marketingTaskDependencySchema = z.object({
  dependsOnTaskId: z.string(),
});

export const marketingTaskCommentSchema = z.object({
  body: trimmed(5000),
});

export const marketingTaskAttachmentSchema = z.object({
  fileName: trimmed(500),
  fileUrl: trimmed(2000),
  mimeType: optionalTrimmed(200),
  fileSizeBytes: z.number().int().positive().optional(),
});

export const marketingTaskChecklistItemSchema = z.object({
  label: trimmed(500),
  sortOrder: z.number().int().min(0).optional(),
});

export const marketingTaskChecklistUpdateSchema = z.object({
  isCompleted: z.boolean(),
});

export const marketingTaskStatusTransitionSchema = z.object({
  status: z.nativeEnum(MarketingTaskStatus),
});

export type MarketingTaskCreateInput = z.infer<typeof marketingTaskCreateSchema>;
export type MarketingTaskUpdateInput = z.infer<typeof marketingTaskUpdateSchema>;
