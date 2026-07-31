import type { CrmTaskTypeCode } from "@prisma/client";
import { computeDueAt } from "@/lib/crm-tasks/follow-up-rules";

export type AiFollowUpContext = {
  leadId?: string;
  opportunityId?: string;
  pipelineStage?: string;
  product?: string;
  consentGranted: boolean;
  recentActivities: Array<{ type: string; summary?: string | null; occurredAt: Date }>;
  openTasks: Array<{ title: string; taskTypeCode: CrmTaskTypeCode; dueDate: Date | null }>;
  userInstructions?: string;
};

export type AiFollowUpProposal = {
  suggestionType: string;
  title: string;
  description: string;
  recommendedTaskType: CrmTaskTypeCode;
  recommendedDueAt: Date;
  meetingAgenda?: string;
  callPreparation?: string;
  responseOutline?: string;
  followUpDraft?: string;
  riskSummary?: string;
  aiEvidence: Record<string, unknown>;
  aiGrounded: boolean;
  autoSendBlocked: true;
};

export function generateFollowUpProposal(context: AiFollowUpContext): AiFollowUpProposal | null {
  if (!context.consentGranted) return null;
  if (context.recentActivities.length === 0 && !context.userInstructions) return null;

  const lastActivity = context.recentActivities[0];
  const hasOpenFollowUp = context.openTasks.some((t) => t.taskTypeCode === "FOLLOW_UP");
  const stage = context.pipelineStage?.toUpperCase() ?? "UNKNOWN";

  let recommendedTaskType: CrmTaskTypeCode = "FOLLOW_UP";
  let title = "Schedule follow-up";
  let description = "Based on recent CRM activity, a follow-up task is recommended.";
  let meetingAgenda: string | undefined;
  let callPreparation: string | undefined;
  let responseOutline: string | undefined;
  let followUpDraft: string | undefined;
  let riskSummary: string | undefined;

  if (lastActivity?.type === "MEETING" && !hasOpenFollowUp) {
    recommendedTaskType = "FOLLOW_UP";
    title = "Confirm next steps after meeting";
    description = "Recent meeting logged without an open follow-up task.";
    meetingAgenda = "Review meeting outcomes, confirm decision timeline, and agree next actions.";
  } else if (lastActivity?.type === "EMAIL") {
    recommendedTaskType = "EMAIL";
    title = "Draft response to recent email";
    description = "Respond to the latest logged email activity.";
    responseOutline = "Acknowledge their message, address key points, propose clear next step.";
    followUpDraft = "[Draft only — review before sending. Do not auto-send.]";
  } else if (stage.includes("PROPOSAL") || stage.includes("NEGOTIATION")) {
    recommendedTaskType = "CALL";
    title = "Check in on proposal status";
    callPreparation = "Review proposal terms, identify objections, prepare answers on pricing and timeline.";
    riskSummary = "Deal may stall without proactive follow-up at proposal stage.";
  } else if (context.userInstructions) {
    title = "AI-assisted next action";
    description = context.userInstructions;
  }

  const evidence: Record<string, unknown> = {
    activityCount: context.recentActivities.length,
    lastActivityType: lastActivity?.type,
    lastActivityAt: lastActivity?.occurredAt.toISOString(),
    pipelineStage: context.pipelineStage,
    product: context.product,
    openTaskCount: context.openTasks.length,
    userInstructions: context.userInstructions ?? null,
  };

  return {
    suggestionType: "NEXT_BEST_ACTION",
    title,
    description,
    recommendedTaskType,
    recommendedDueAt: computeDueAt(24),
    meetingAgenda,
    callPreparation,
    responseOutline,
    followUpDraft,
    riskSummary,
    aiEvidence: evidence,
    aiGrounded: true,
    autoSendBlocked: true,
  };
}
