import {
  ContentAssignmentRole,
  ContentCampaignStatus,
  ContentDeadlineType,
  ContentPriority,
  ContentTaskStatus,
  SocialProvider,
} from "@prisma/client";
import { z } from "zod";

const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const campaignCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  objective: optionalTrimmed(2000),
  description: optionalTrimmed(5000),
  ownerUserId: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  targetPlatforms: z.array(z.nativeEnum(SocialProvider)).max(12).optional(),
  targetAudienceId: z.string().optional(),
  offerId: z.string().optional(),
  landingPageUrl: optionalTrimmed(2000),
  status: z.nativeEnum(ContentCampaignStatus).optional(),
  marketingObjectiveId: z.string().optional(),
  memberUserIds: z.array(z.string()).max(50).optional(),
});

export const campaignUpdateSchema = campaignCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field must be provided." },
);

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: optionalTrimmed(5000),
  campaignId: z.string().optional(),
  contentItemId: z.string().optional(),
  status: z.nativeEnum(ContentTaskStatus).optional(),
  assigneeUserId: z.string().optional().nullable(),
  ownerUserId: z.string().optional(),
  dueAt: z.string().datetime().optional().nullable(),
  priority: z.nativeEnum(ContentPriority).optional(),
});

export const taskUpdateSchema = taskCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field must be provided." },
);

export const assignmentCreateSchema = z.object({
  userId: z.string(),
  role: z.nativeEnum(ContentAssignmentRole),
  campaignId: z.string().optional(),
  contentItemId: z.string().optional(),
  taskId: z.string().optional(),
});

export const deadlineCreateSchema = z.object({
  deadlineType: z.nativeEnum(ContentDeadlineType),
  dueAt: z.string().datetime(),
  campaignId: z.string().optional(),
  contentItemId: z.string().optional(),
  taskId: z.string().optional(),
});

export const checklistItemUpdateSchema = z.object({
  isCompleted: z.boolean(),
});

export const operationsListFiltersSchema = z.object({
  campaignId: z.string().optional(),
  contentItemId: z.string().optional(),
  status: z.string().optional(),
  assigneeUserId: z.string().optional(),
  overdueOnly: z.coerce.boolean().optional(),
  myWork: z.coerce.boolean().optional(),
  view: z.enum(["list", "board", "calendar", "timeline"]).optional(),
});

export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;
export type DeadlineCreateInput = z.infer<typeof deadlineCreateSchema>;
