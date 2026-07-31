import type { CrmFollowUpRuleTrigger, CrmTaskStatus, CrmTaskTypeCode, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { generateFollowUpProposal } from "@/lib/crm-tasks/ai-assistant";
import {
  computeDueAt,
  evaluateLeadRules,
  evaluateMeetingRules,
  evaluateOpportunityRules,
  type FollowUpCandidate,
} from "@/lib/crm-tasks/follow-up-rules";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";
import { crmTaskService } from "@/server/services/crm-task-service";

const ACTIVE_TASK_STATUSES: CrmTaskStatus[] = ["OPEN", "IN_PROGRESS", "OVERDUE", "DEFERRED"];
const ACTIVE_TASK_FILTER = { status: { in: ACTIVE_TASK_STATUSES } };

export const crmFollowUpService = {
  async listRules(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.crmFollowUpRule.findMany({
      where: { organisationId, OR: [{ brandId }, { brandId: null }] },
      orderBy: { createdAt: "asc" },
    });
  },

  async createRule(
    brandId: string,
    organisationId: string,
    input: {
      name: string;
      trigger: CrmFollowUpRuleTrigger;
      taskTypeCode?: CrmTaskTypeCode;
      dueOffsetHours?: number;
      conditions?: Prisma.InputJsonValue;
    },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.crmFollowUpRule.create({
      data: {
        organisationId,
        brandId,
        name: input.name,
        trigger: input.trigger,
        taskTypeCode: input.taskTypeCode ?? "FOLLOW_UP",
        dueOffsetHours: input.dueOffsetHours ?? 24,
        conditions: input.conditions,
      },
    });
  },

  async evaluateRules(brandId: string, organisationId: string, context: TenantContext) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const candidates: FollowUpCandidate[] = [];

    const leads = await prisma.crmLead.findMany({
      where: { organisationId, brandId, archivedAt: null },
      include: { tasks: { where: ACTIVE_TASK_FILTER } },
      take: 100,
    });

    for (const lead of leads) {
      candidates.push(
        ...evaluateLeadRules({
          id: lead.id,
          status: lead.status,
          qualificationState: lead.qualificationState,
          ownerUserId: lead.ownerUserId,
          lastActivityAt: lead.lastActivityAt,
          hasOpenTask: lead.tasks.length > 0,
          hasDemoRequest: lead.primaryProductInterest?.toLowerCase().includes("demo") ?? false,
          hasRecentReply: false,
          hasResponseTask: lead.tasks.some((t) => t.taskTypeCode === "EMAIL" || t.taskTypeCode === "FOLLOW_UP"),
        }),
      );
    }

    const opportunities = await prisma.crmOpportunity.findMany({
      where: { organisationId, brandId, status: "OPEN", archivedAt: null },
      include: {
        currentStage: true,
        tasks: { where: ACTIVE_TASK_FILTER },
      },
      take: 100,
    });

    for (const opp of opportunities) {
      candidates.push(
        ...evaluateOpportunityRules({
          id: opp.id,
          name: opp.name,
          status: opp.status,
          stageCategory: opp.currentStage?.category,
          lastActivityAt: opp.lastActivityAt,
          nextAction: opp.nextAction,
          hasOpenTask: opp.tasks.length > 0,
          expectedCloseDate: opp.expectedCloseDate,
        }),
      );
    }

    const meetings = await prisma.crmMeetingRecord.findMany({
      where: {
        activity: { organisationId, brandId },
        outcome: { not: null },
        followUpTaskId: null,
      },
      include: { activity: true },
      take: 50,
    });

    for (const meeting of meetings) {
      candidates.push(
        ...evaluateMeetingRules({
          id: meeting.id,
          opportunityId: meeting.activity.opportunityId ?? undefined,
          leadId: meeting.activity.leadId ?? undefined,
          outcome: meeting.outcome,
          hasFollowUpTask: false,
          completedAt: meeting.activity.occurredAt,
        }),
      );
    }

    const activeRules = await prisma.crmFollowUpRule.findMany({
      where: { organisationId, isActive: true, OR: [{ brandId }, { brandId: null }] },
    });
    const activeTriggers = new Set(activeRules.map((r) => r.trigger));
    const filtered = candidates.filter((c) => activeTriggers.size === 0 || activeTriggers.has(c.trigger));

    const suggestions = [];
    for (const candidate of filtered.slice(0, 50)) {
      const existing = await prisma.crmFollowUpSuggestion.findFirst({
        where: {
          organisationId,
          brandId,
          status: "PENDING",
          title: candidate.title,
          ...(candidate.entityType === "lead" ? { leadId: candidate.entityId } : {}),
          ...(candidate.entityType === "opportunity" ? { opportunityId: candidate.entityId } : {}),
        },
      });
      if (existing) {
        suggestions.push(existing);
        continue;
      }
      const rule = activeRules.find((r) => r.trigger === candidate.trigger);
      const suggestion = await prisma.crmFollowUpSuggestion.create({
        data: {
          organisationId,
          brandId,
          ruleId: rule?.id,
          leadId: candidate.entityType === "lead" ? candidate.entityId : undefined,
          opportunityId: candidate.entityType === "opportunity" ? candidate.entityId : undefined,
          suggestionType: candidate.trigger,
          title: candidate.title,
          description: candidate.description,
          recommendedTaskType: candidate.recommendedTaskType,
          recommendedDueAt: computeDueAt(rule?.dueOffsetHours ?? candidate.dueOffsetHours),
          aiEvidence: candidate.evidence as Prisma.InputJsonValue,
          aiGrounded: true,
          autoSendBlocked: true,
        },
      });
      suggestions.push(suggestion);
    }

    return { candidates: filtered, suggestions };
  },

  async listSuggestions(brandId: string, organisationId: string, context: TenantContext, status = "PENDING") {
    await brandService.getById(brandId, organisationId, context);
    return prisma.crmFollowUpSuggestion.findMany({
      where: { organisationId, brandId, status: status as "PENDING" | "ACCEPTED" | "DISMISSED" | "EXPIRED" },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  async generateAiSuggestion(
    brandId: string,
    organisationId: string,
    input: { leadId?: string; opportunityId?: string; consentGranted: boolean; userInstructions?: string },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    if (!input.consentGranted) throw new AppError("VALIDATION_ERROR", "Consent is required for AI follow-up suggestions.");

    const activities = await prisma.crmActivity.findMany({
      where: {
        organisationId,
        brandId,
        ...(input.leadId ? { leadId: input.leadId } : {}),
        ...(input.opportunityId ? { opportunityId: input.opportunityId } : {}),
      },
      orderBy: { occurredAt: "desc" },
      take: 10,
    });

    const openTasks = await prisma.crmTask.findMany({
      where: {
        organisationId,
        brandId,
        ...ACTIVE_TASK_FILTER,
        ...(input.leadId ? { leadId: input.leadId } : {}),
        ...(input.opportunityId ? { opportunityId: input.opportunityId } : {}),
      },
      take: 20,
    });

    let pipelineStage: string | undefined;
    let product: string | undefined;
    if (input.opportunityId) {
      const opp = await prisma.crmOpportunity.findFirst({
        where: { id: input.opportunityId, organisationId, brandId },
        include: { currentStage: true },
      });
      pipelineStage = opp?.currentStage?.name;
      product = opp?.product ?? undefined;
    }

    const proposal = generateFollowUpProposal({
      leadId: input.leadId,
      opportunityId: input.opportunityId,
      pipelineStage,
      product,
      consentGranted: input.consentGranted,
      recentActivities: activities.map((a) => ({
        type: a.activityType,
        summary: a.summary,
        occurredAt: a.occurredAt,
      })),
      openTasks: openTasks.map((t) => ({
        title: t.title,
        taskTypeCode: t.taskTypeCode,
        dueDate: t.dueDate,
      })),
      userInstructions: input.userInstructions,
    });

    if (!proposal) throw new AppError("VALIDATION_ERROR", "Insufficient CRM evidence for AI suggestion.");

    return prisma.crmFollowUpSuggestion.create({
      data: {
        organisationId,
        brandId,
        leadId: input.leadId,
        opportunityId: input.opportunityId,
        suggestionType: proposal.suggestionType,
        title: proposal.title,
        description: [
          proposal.description,
          proposal.meetingAgenda ? `Agenda: ${proposal.meetingAgenda}` : null,
          proposal.callPreparation ? `Call prep: ${proposal.callPreparation}` : null,
          proposal.responseOutline ? `Outline: ${proposal.responseOutline}` : null,
          proposal.followUpDraft ? `Draft: ${proposal.followUpDraft}` : null,
          proposal.riskSummary ? `Risk: ${proposal.riskSummary}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        recommendedTaskType: proposal.recommendedTaskType,
        recommendedDueAt: proposal.recommendedDueAt,
        aiEvidence: proposal.aiEvidence as Prisma.InputJsonValue,
        aiGrounded: proposal.aiGrounded,
        autoSendBlocked: true,
      },
    });
  },

  async acceptSuggestion(
    suggestionId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    const suggestion = await prisma.crmFollowUpSuggestion.findFirst({
      where: { id: suggestionId, organisationId, brandId },
    });
    if (!suggestion) throw new AppError("NOT_FOUND", "Suggestion not found.");
    if (suggestion.status !== "PENDING") throw new AppError("VALIDATION_ERROR", "Suggestion already resolved.");

    const task = await crmTaskService.createTask(
      brandId,
      organisationId,
      {
        title: suggestion.title,
        description: suggestion.description ?? undefined,
        taskTypeCode: suggestion.recommendedTaskType ?? "FOLLOW_UP",
        dueDate: suggestion.recommendedDueAt?.toISOString(),
        leadId: suggestion.leadId ?? undefined,
        opportunityId: suggestion.opportunityId ?? undefined,
      },
      context,
    );

    return prisma.crmFollowUpSuggestion.update({
      where: { id: suggestionId },
      data: { status: "ACCEPTED", taskId: task.id, resolvedAt: new Date() },
    });
  },

  async dismissSuggestion(suggestionId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const suggestion = await prisma.crmFollowUpSuggestion.findFirst({
      where: { id: suggestionId, organisationId, brandId },
    });
    if (!suggestion) throw new AppError("NOT_FOUND", "Suggestion not found.");
    return prisma.crmFollowUpSuggestion.update({
      where: { id: suggestionId },
      data: { status: "DISMISSED", resolvedAt: new Date() },
    });
  },
};
