import { z } from "zod";

export const buildGraphSchema = z.object({
  seoSiteId: z.string(),
  crawlRunId: z.string().optional(),
});

export const proposalActionSchema = z.object({
  recommendationId: z.string().optional(),
  action: z.enum(["APPROVE", "REJECT", "EDIT", "ASSIGN", "EXPORT", "IMPLEMENT", "VERIFY"]),
  editedAnchorConcept: z.string().optional(),
  assignedToUserId: z.string().optional(),
});

export const proposalStatusSchema = z.object({
  proposalId: z.string(),
  status: z.enum(["APPROVED", "REJECTED", "EXPORTED", "IMPLEMENTED", "VERIFIED"]),
});
