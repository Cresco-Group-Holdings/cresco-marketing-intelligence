import { z } from "zod";
import { MarketingApprovalStatus, MarketingApprovalType } from "@prisma/client";

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const marketingApprovalListQuerySchema = z.object({
  status: z.nativeEnum(MarketingApprovalStatus).optional(),
  type: z.nativeEnum(MarketingApprovalType).optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  myRequests: z.coerce.boolean().optional(),
  pendingOnly: z.coerce.boolean().optional(),
});

export const marketingApprovalCreateSchema = z.object({
  type: z.nativeEnum(MarketingApprovalType),
  title: trimmed(300),
  description: optionalTrimmed(5000),
  entityType: trimmed(100),
  entityId: z.string(),
});

export const marketingApprovalDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
  feedback: optionalTrimmed(5000),
});

export type MarketingApprovalCreateInput = z.infer<typeof marketingApprovalCreateSchema>;
export type MarketingApprovalDecisionInput = z.infer<typeof marketingApprovalDecisionSchema>;
