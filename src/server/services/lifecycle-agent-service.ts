import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { isTaskOverdue } from "@/lib/crm-tasks/lifecycle";
import { normaliseEmailAddress } from "@/lib/email/suppression";
import { AppError } from "@/lib/errors";
import type { LifecycleAnalysisInput } from "@/lib/lifecycle-agent/analysis-inputs";
import { evaluateActionProposal, canApplyAction } from "@/lib/lifecycle-agent/actions";
import { runLifecycleAnalysis } from "@/lib/lifecycle-agent/analyzer";
import type { LifecycleBrief } from "@/lib/lifecycle-agent/briefs";
import { validateDraft } from "@/lib/lifecycle-agent/drafts";
import { validateFeedback, recordOutcome } from "@/lib/lifecycle-agent/feedback";
import { mapRecommendationToActionClass } from "@/lib/lifecycle-agent/recommendations";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";

const runInclude = {
  evidence: true,
  findings: true,
  recommendations: {
    include: {
      drafts: true,
      actionProposals: { include: { approvals: true } },
      feedback: true,
      outcomes: true,
      finding: true,
    },
  },
  initiatedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.LifecycleAgentRunInclude;

export type StartRunInput = {
  reviewType: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  scope?: LifecycleAnalysisInput["scope"];
  userNotes?: string;
};

export type BriefType = "daily" | "weekly" | "trial" | "renewal" | "health";

const BRIEF_TYPE_MAP: Record<BriefType, keyof ReturnType<typeof runLifecycleAnalysis>["briefs"]> = {
  daily: "dailySales",
  weekly: "weeklyPipeline",
  trial: "trialRisk",
  renewal: "renewal",
  health: "lifecycleHealth",
};

const REVIEW_TYPE_MAP: Record<string, Prisma.LifecycleAgentRunCreateInput["reviewType"]> = {
  DAILY_SALES_BRIEF: "DAILY_SALES_BRIEF",
  WEEKLY_PIPELINE_REVIEW: "WEEKLY_PIPELINE_REVIEW",
  TRIAL_RISK_REVIEW: "TRIAL_RISK_REVIEW",
  RENEWAL_REVIEW: "RENEWAL_REVIEW",
  LIFECYCLE_HEALTH_SUMMARY: "LIFECYCLE_HEALTH_SUMMARY",
  ON_DEMAND: "ON_DEMAND",
};

const FINDING_TYPE_MAP: Record<string, Prisma.LifecycleAgentFindingCreateInput["findingType"]> = {
  NO_OWNER: "LEAD_WITHOUT_OWNER",
  NO_NEXT_ACTION: "NO_NEXT_ACTION",
  OVERDUE_TASK: "LEAD_WITHOUT_FOLLOW_UP",
  STALE_OPPORTUNITY: "OPPORTUNITY_STALLED",
  STALE_LEAD: "STALE_LEAD",
  CLOSE_DATE_PASSED: "OPPORTUNITY_STALLED",
  TRIAL_ENDING_SOON: "TRIAL_ENDING",
  TRIAL_INACTIVE: "TRIAL_NOT_ACTIVATED",
  RENEWAL_APPROACHING: "RENEWAL_APPROACHING",
  RENEWAL_AT_RISK: "RENEWAL_APPROACHING",
  CHURN_SIGNAL: "CHURN_RISK_SIGNAL",
  LOW_ENGAGEMENT: "CUSTOMER_INACTIVE",
  MISSING_DECISION_MAKER: "QUALIFICATION_DATA_MISSING",
  MISSING_VALUE: "QUALIFICATION_DATA_MISSING",
  STAGE_DURATION_EXCEEDED: "OPPORTUNITY_STALLED",
  STAGE_REVERSAL: "OPPORTUNITY_STALLED",
  CONSENT_RESTRICTED: "CONSENT_RESTRICTION",
  SUPPRESSED_CONTACT: "CONSENT_RESTRICTION",
  DATA_STALE: "DATA_QUALITY_ISSUE",
  INSUFFICIENT_CRM_DATA: "DATA_QUALITY_ISSUE",
  STRONG_ENGAGEMENT: "NEW_HIGH_PRIORITY_LEAD",
  HEALTHY_PIPELINE: "OTHER",
  OTHER: "OTHER",
};

const RECOMMENDATION_TYPE_MAP: Record<string, Prisma.LifecycleAgentRecommendationCreateInput["recommendationType"]> = {
  ASSIGN_OWNER: "ASSIGN_OWNER",
  CREATE_FOLLOW_UP_TASK: "CREATE_TASK",
  SCHEDULE_CALL: "PREPARE_CALL",
  SCHEDULE_MEETING: "BOOK_DEMO",
  DRAFT_EMAIL: "DRAFT_FOLLOW_UP",
  REVIEW_PROPOSAL: "REVIEW_OPPORTUNITY",
  TRIAL_CHECK_IN: "CREATE_CS_TASK",
  RENEWAL_OUTREACH: "PREPARE_RENEWAL_OUTREACH",
  RE_ENGAGE: "CREATE_CS_TASK",
  ESCALATE_TO_MANAGER: "MARK_MANUAL_REVIEW",
  UPDATE_PIPELINE_STAGE: "REVIEW_OPPORTUNITY",
  COLLECT_MISSING_INFO: "REQUEST_QUALIFICATION_INFO",
  WAIT_FOR_MORE_DATA: "MARK_MANUAL_REVIEW",
  REVIEW_CONSENT: "MARK_MANUAL_REVIEW",
  INFORMATION_ONLY: "MARK_MANUAL_REVIEW",
};

const ACTION_CLASS_MAP: Record<string, Prisma.LifecycleAgentActionProposalCreateInput["actionType"]> = {
  CREATE_TASK: "CREATE_TASK",
  REQUEST_OWNER_ASSIGNMENT: "ASSIGN_OWNER_REQUEST",
  DRAFT_MESSAGE: "CREATE_MESSAGE_DRAFT",
  REQUEST_MEETING: "CREATE_MEETING_PREPARATION",
  REQUEST_STAGE_CHANGE: "CREATE_PIPELINE_REVIEW",
  INFORMATION_ONLY: "CREATE_PIPELINE_REVIEW",
};

const DRAFT_TYPE_MAP: Record<string, Prisma.LifecycleAgentDraftCreateInput["draftType"]> = {
  EMAIL: "EMAIL",
  CALL_SCRIPT: "POST_DEMO_FOLLOW_UP",
  MEETING_AGENDA: "MEETING_CONFIRMATION",
  RENEWAL_OUTREACH: "RENEWAL_NOTE",
  TRIAL_CHECK_IN: "TRIAL_REMINDER",
  FOLLOW_UP: "REENGAGEMENT_MESSAGE",
  LINKEDIN_RESPONSE: "LINKEDIN_RESPONSE",
  PAYMENT_REMINDER: "PAYMENT_REMINDER",
};

const FEEDBACK_STATUS_MAP: Record<string, Prisma.LifecycleAgentFeedbackCreateInput["status"]> = {
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  DEFERRED: "DEFERRED",
  IMPLEMENTED: "ACTION_COMPLETED",
  OUTCOME_MEASURED: "OUTCOME_MEASURED",
  OUTCOME_UNAVAILABLE: "OUTCOME_UNKNOWN",
  EDITED: "EDITED",
  ACTION_COMPLETED: "ACTION_COMPLETED",
  OUTCOME_UNKNOWN: "OUTCOME_UNKNOWN",
};

export const lifecycleAgentService = {
  async listRuns(
    brandId: string,
    organisationId: string,
    context: TenantContext,
    filters?: { reviewType?: string },
  ) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.lifecycleAgentRun.findMany({
      where: {
        organisationId,
        brandId,
        ...(filters?.reviewType
          ? { reviewType: filters.reviewType as Prisma.EnumLifecycleAgentReviewTypeFilter["equals"] }
          : {}),
      },
      include: runInclude,
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },

  async getRun(runId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const run = await prisma.lifecycleAgentRun.findFirst({
      where: { id: runId, organisationId, brandId },
      include: runInclude,
    });
    if (!run) throw new AppError("NOT_FOUND", "Lifecycle agent run not found.");
    return run;
  },

  async listFindings(
    runId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
    filters?: { includeDismissed?: boolean },
  ) {
    await this.getRun(runId, brandId, organisationId, context);
    const findings = await prisma.lifecycleAgentFinding.findMany({
      where: { runId, run: { organisationId, brandId } },
      include: { recommendations: true, evidence: true },
      orderBy: [{ priorityScore: "desc" }, { createdAt: "asc" }],
    });
    if (filters?.includeDismissed) return findings;
    return findings.filter((f) => !isFindingDismissed(f.limitations));
  },

  async listRecommendations(
    runId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    await this.getRun(runId, brandId, organisationId, context);
    return prisma.lifecycleAgentRecommendation.findMany({
      where: { runId, run: { organisationId, brandId } },
      include: {
        finding: true,
        drafts: true,
        actionProposals: { include: { approvals: true } },
        feedback: { include: { user: { select: { id: true, displayName: true } } } },
      },
      orderBy: [{ priorityScore: "desc" }, { createdAt: "asc" }],
    });
  },

  async listDrafts(recommendationId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const recommendation = await prisma.lifecycleAgentRecommendation.findFirst({
      where: { id: recommendationId, run: { organisationId, brandId } },
    });
    if (!recommendation) throw new AppError("NOT_FOUND", "Recommendation not found.");
    return prisma.lifecycleAgentDraft.findMany({
      where: { recommendationId },
      orderBy: { createdAt: "desc" },
    });
  },

  async getRecommendation(
    recommendationId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const recommendation = await prisma.lifecycleAgentRecommendation.findFirst({
      where: { id: recommendationId, run: { organisationId, brandId } },
      include: {
        run: { include: { evidence: true } },
        finding: true,
        drafts: true,
        actionProposals: { include: { approvals: true, outcomes: true } },
        feedback: { include: { user: { select: { id: true, displayName: true } } } },
        outcomes: true,
      },
    });
    if (!recommendation) throw new AppError("NOT_FOUND", "Recommendation not found.");
    return recommendation;
  },

  async startRun(brandId: string, organisationId: string, input: StartRunInput, context: TenantContext) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const analysisInput = await loadCrmAnalysisInput(
      brandId,
      organisationId,
      brand.projectId,
      input.dateRangeStart,
      input.dateRangeEnd,
      input.scope,
      input.userNotes,
    );

    let analysis;
    try {
      analysis = runLifecycleAnalysis(analysisInput);
    } catch (e) {
      throw new AppError("VALIDATION_ERROR", e instanceof Error ? e.message : "Analysis blocked by guardrails.");
    }

    const reviewType = REVIEW_TYPE_MAP[input.reviewType] ?? "ON_DEMAND";

    const run = await prisma.$transaction(async (tx) => {
      const createdRun = await tx.lifecycleAgentRun.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          reviewType,
          status: "RUNNING",
          dateRangeStart: analysisInput.dateRangeStart,
          dateRangeEnd: analysisInput.dateRangeEnd,
          initiatedByUserId: context.userProfileId,
          limitations: {
            guardrails: analysis.guardrails,
            warnings: analysis.guardrails.warnings,
          } as Prisma.InputJsonValue,
        },
      });

      await tx.lifecycleAgentEvidence.create({
        data: {
          runId: createdRun.id,
          dateRangeStart: analysis.evidence.dateRangeStart,
          dateRangeEnd: analysis.evidence.dateRangeEnd,
          lifecycle: analysis.evidence.scopeSummary,
          activities: analysis.evidence.recentActivities as Prisma.InputJsonValue,
          scoreSnapshot: analysis.evidence.metrics as Prisma.InputJsonValue,
          sourceFreshness: {
            freshnessHours: analysis.evidence.freshnessHours,
            dataConfidenceLevel: analysis.evidence.dataConfidenceLevel,
          } as Prisma.InputJsonValue,
          missingInfo: analysis.evidence.qualityWarnings as Prisma.InputJsonValue,
          alternativeExplanations: analysis.evidence.predictiveSignalDisclaimer,
        },
      });

      const findingIdByType = new Map<string, string>();

      for (const finding of analysis.findings) {
        const createdFinding = await tx.lifecycleAgentFinding.create({
          data: {
            runId: createdRun.id,
            findingType: mapFindingType(finding.findingType),
            severity: finding.severity,
            title: finding.title,
            description: finding.description,
            crmRecordType: finding.entityType,
            crmRecordId: finding.entityId,
            crmLeadId: finding.entityType === "lead" ? finding.entityId : null,
            crmOpportunityId: finding.entityType === "opportunity" ? finding.entityId : null,
            dataConfidence: finding.suppressed ? 0 : 1,
            limitations: finding.suppressionReason
              ? ({ suppressed: finding.suppressed, suppressionReason: finding.suppressionReason } as Prisma.InputJsonValue)
              : undefined,
          },
        });
        findingIdByType.set(`${finding.findingType}:${finding.entityId ?? "portfolio"}`, createdFinding.id);
      }

      for (const rec of analysis.prioritisedRecommendations) {
        const findingKey = `${rec.findingType}:${rec.entityId ?? "portfolio"}`;
        const findingId = findingIdByType.get(findingKey) ?? null;
        await createRecommendationWithActions(tx, createdRun.id, findingId, rec, analysis.actionProposals);
      }

      const completed = await tx.lifecycleAgentRun.update({
        where: { id: createdRun.id },
        data: {
          status: "COMPLETED",
          summary: `Completed ${input.reviewType} review with ${analysis.findings.length} findings and ${analysis.prioritisedRecommendations.length} recommendations.`,
        },
        include: runInclude,
      });

      await recordAuditEvent(
        {
          organisationId,
          projectId: brand.projectId,
          actorUserId: context.userProfileId,
          action: "lifecycleAgent.run.completed",
          resourceType: "LifecycleAgentRun",
          resourceId: completed.id,
          metadata: {
            reviewType: input.reviewType,
            findingCount: analysis.findings.length,
            recommendationCount: analysis.prioritisedRecommendations.length,
          },
        },
        tx,
      );

      return completed;
    });

    return run;
  },

  async generateBrief(
    brandId: string,
    organisationId: string,
    briefType: BriefType,
    context: TenantContext,
    options?: { dateRangeStart?: string; dateRangeEnd?: string; scope?: LifecycleAnalysisInput["scope"] },
  ): Promise<LifecycleBrief> {
    const brand = await brandService.getById(brandId, organisationId, context);
    const dateRangeEnd = options?.dateRangeEnd ?? new Date().toISOString();
    const dateRangeStart =
      options?.dateRangeStart ?? new Date(Date.now() - 30 * 86_400_000).toISOString();

    const analysisInput = await loadCrmAnalysisInput(
      brandId,
      organisationId,
      brand.projectId,
      dateRangeStart,
      dateRangeEnd,
      options?.scope,
    );

    const analysis = runLifecycleAnalysis(analysisInput);
    const briefKey = BRIEF_TYPE_MAP[briefType];
    const brief = analysis.briefs[briefKey];
    if (!brief) throw new AppError("VALIDATION_ERROR", `Brief type ${briefType} is not available.`);

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "lifecycleAgent.brief.generated",
      resourceType: "LifecycleAgentBrief",
      resourceId: brandId,
      metadata: { briefType, briefKey },
    });

    return brief;
  },

  async createDraft(
    recommendationId: string,
    brandId: string,
    organisationId: string,
    input: { draftType: string; subject?: string; body: string; toneProfile?: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const validation = validateDraft(input);
    if (!validation.valid) throw new AppError("VALIDATION_ERROR", validation.errors.join(" "));

    const recommendation = await prisma.lifecycleAgentRecommendation.findFirst({
      where: { id: recommendationId, run: { organisationId, brandId } },
    });
    if (!recommendation) throw new AppError("NOT_FOUND", "Recommendation not found.");

    const draftType = DRAFT_TYPE_MAP[input.draftType] ?? "EMAIL";
    const draft = await prisma.lifecycleAgentDraft.create({
      data: {
        recommendationId,
        draftType,
        subject: input.subject,
        body: input.body,
        toneProfile: input.toneProfile,
        consentEligible: false,
        safetyWarnings: validation.warnings as Prisma.InputJsonValue,
      },
    });

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "lifecycleAgent.draft.created",
      resourceType: "LifecycleAgentDraft",
      resourceId: draft.id,
      metadata: { recommendationId, draftType: input.draftType },
    });

    return draft;
  },

  async proposeAction(
    recommendationId: string,
    brandId: string,
    organisationId: string,
    input: {
      actionClass: string;
      title: string;
      description: string;
      payload?: Record<string, unknown>;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const recommendation = await prisma.lifecycleAgentRecommendation.findFirst({
      where: { id: recommendationId, run: { organisationId, brandId } },
    });
    if (!recommendation) throw new AppError("NOT_FOUND", "Recommendation not found.");

    const evaluation = evaluateActionProposal({
      actionClass: input.actionClass,
      title: input.title,
      description: input.description,
      payload: input.payload,
      fromLlmOutput: false,
    });

    const actionType = ACTION_CLASS_MAP[input.actionClass] ?? "CREATE_TASK";
    const proposal = await prisma.lifecycleAgentActionProposal.create({
      data: {
        recommendationId,
        actionType,
        payload: input.payload as Prisma.InputJsonValue,
        requiresApproval: evaluation.requiresApproval,
        status: evaluation.status === "BLOCKED" ? "REJECTED" : "PENDING",
      },
      include: { approvals: true },
    });

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "lifecycleAgent.action.proposed",
      resourceType: "LifecycleAgentActionProposal",
      resourceId: proposal.id,
      metadata: { recommendationId, actionClass: input.actionClass, status: proposal.status },
    });

    return proposal;
  },

  async approveAction(
    actionProposalId: string,
    brandId: string,
    organisationId: string,
    notes: string | undefined,
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const proposal = await prisma.lifecycleAgentActionProposal.findFirst({
      where: { id: actionProposalId, recommendation: { run: { organisationId, brandId } } },
      include: { recommendation: true },
    });
    if (!proposal) throw new AppError("NOT_FOUND", "Action proposal not found.");
    if (proposal.status === "REJECTED") {
      throw new AppError("VALIDATION_ERROR", "Action proposal is rejected and cannot be approved.");
    }
    if (!canApplyAction(proposal.status, true)) {
      throw new AppError("VALIDATION_ERROR", "Action cannot be applied without approval.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.lifecycleAgentApproval.create({
        data: {
          actionProposalId,
          approverUserId: context.userProfileId,
          status: "APPROVED",
          notes,
        },
      });
      return tx.lifecycleAgentActionProposal.update({
        where: { id: actionProposalId },
        data: { status: "APPROVED" },
        include: { approvals: true, recommendation: true },
      });
    });

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "lifecycleAgent.action.approved",
      resourceType: "LifecycleAgentActionProposal",
      resourceId: actionProposalId,
    });

    return updated;
  },

  async rejectAction(
    actionProposalId: string,
    brandId: string,
    organisationId: string,
    notes: string | undefined,
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const proposal = await prisma.lifecycleAgentActionProposal.findFirst({
      where: { id: actionProposalId, recommendation: { run: { organisationId, brandId } } },
    });
    if (!proposal) throw new AppError("NOT_FOUND", "Action proposal not found.");

    const updated = await prisma.$transaction(async (tx) => {
      await tx.lifecycleAgentApproval.create({
        data: {
          actionProposalId,
          approverUserId: context.userProfileId,
          status: "REJECTED",
          notes,
        },
      });
      return tx.lifecycleAgentActionProposal.update({
        where: { id: actionProposalId },
        data: { status: "REJECTED" },
        include: { approvals: true, recommendation: true },
      });
    });

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "lifecycleAgent.action.rejected",
      resourceType: "LifecycleAgentActionProposal",
      resourceId: actionProposalId,
    });

    return updated;
  },

  async submitFeedback(
    recommendationId: string,
    brandId: string,
    organisationId: string,
    input: { status: string; userExplanation?: string; reason?: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const validation = validateFeedback({
      status: input.status,
      userExplanation: input.userExplanation ?? input.reason,
      recommendationId,
    });
    if (!validation.valid) throw new AppError("VALIDATION_ERROR", validation.errors.join(" "));

    const recommendation = await prisma.lifecycleAgentRecommendation.findFirst({
      where: { id: recommendationId, run: { organisationId, brandId } },
    });
    if (!recommendation) throw new AppError("NOT_FOUND", "Recommendation not found.");

    const feedback = await prisma.lifecycleAgentFeedback.create({
      data: {
        recommendationId,
        userId: context.userProfileId,
        status: mapFeedbackStatus(input.status),
        reason: input.userExplanation ?? input.reason,
      },
    });

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "lifecycleAgent.feedback.submitted",
      resourceType: "LifecycleAgentFeedback",
      resourceId: feedback.id,
      metadata: { recommendationId, status: input.status },
    });

    return feedback;
  },

  async recordOutcome(
    recommendationId: string,
    brandId: string,
    organisationId: string,
    input: {
      actionProposalId?: string;
      outcomeType: string;
      outcomeValue?: string;
      preMetrics?: Record<string, number | string>;
      postMetrics?: Record<string, number | string>;
      outcomeStatus?: string;
      activityLogged?: boolean;
      stageProgressed?: boolean;
      notes?: string;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const recommendation = await prisma.lifecycleAgentRecommendation.findFirst({
      where: { id: recommendationId, run: { organisationId, brandId } },
    });
    if (!recommendation) throw new AppError("NOT_FOUND", "Recommendation not found.");

    const outcomeResult = recordOutcome({
      preMetrics: input.preMetrics,
      postMetrics: input.postMetrics,
      outcomeStatus: (input.outcomeStatus ?? "PENDING") as "PENDING" | "MEASURED" | "UNAVAILABLE",
      activityLogged: input.activityLogged,
      stageProgressed: input.stageProgressed,
      notes: input.notes,
    });

    const outcome = await prisma.lifecycleAgentOutcome.create({
      data: {
        recommendationId,
        actionProposalId: input.actionProposalId,
        outcomeType: input.outcomeType,
        outcomeValue: input.outcomeValue ?? outcomeResult.reason,
        measuredAt: outcomeResult.outcomeStatus === "MEASURED" ? new Date() : null,
        metadata: {
          successClaimed: outcomeResult.successClaimed,
          effectivenessClaimed: outcomeResult.effectivenessClaimed,
          preMetrics: input.preMetrics,
          postMetrics: input.postMetrics,
          notes: input.notes,
        } as Prisma.InputJsonValue,
      },
    });

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "lifecycleAgent.outcome.recorded",
      resourceType: "LifecycleAgentOutcome",
      resourceId: outcome.id,
      metadata: { recommendationId, outcomeType: input.outcomeType },
    });

    return outcome;
  },

  async dismissFinding(
    findingId: string,
    brandId: string,
    organisationId: string,
    reason: string | undefined,
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const finding = await prisma.lifecycleAgentFinding.findFirst({
      where: { id: findingId, run: { organisationId, brandId } },
    });
    if (!finding) throw new AppError("NOT_FOUND", "Finding not found.");
    if (isFindingDismissed(finding.limitations)) {
      throw new AppError("VALIDATION_ERROR", "Finding is already dismissed.");
    }

    const updated = await prisma.lifecycleAgentFinding.update({
      where: { id: findingId },
      data: {
        limitations: {
          ...(typeof finding.limitations === "object" && finding.limitations !== null
            ? (finding.limitations as Record<string, unknown>)
            : {}),
          dismissed: true,
          dismissedAt: new Date().toISOString(),
          dismissedByUserId: context.userProfileId,
          dismissReason: reason,
        } as Prisma.InputJsonValue,
      },
    });

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "lifecycleAgent.finding.dismissed",
      resourceType: "LifecycleAgentFinding",
      resourceId: findingId,
      metadata: { reason },
    });

    return updated;
  },
};

function isFindingDismissed(limitations: Prisma.JsonValue | null): boolean {
  if (!limitations || typeof limitations !== "object" || Array.isArray(limitations)) return false;
  return (limitations as Record<string, unknown>).dismissed === true;
}

function mapFindingType(findingType: string): Prisma.LifecycleAgentFindingCreateInput["findingType"] {
  return FINDING_TYPE_MAP[findingType] ?? "OTHER";
}

function mapRecommendationType(
  recommendationType: string,
): Prisma.LifecycleAgentRecommendationCreateInput["recommendationType"] {
  return RECOMMENDATION_TYPE_MAP[recommendationType] ?? "MARK_MANUAL_REVIEW";
}

function mapFeedbackStatus(status: string): Prisma.LifecycleAgentFeedbackCreateInput["status"] {
  return FEEDBACK_STATUS_MAP[status] ?? "ACCEPTED";
}

async function loadCrmAnalysisInput(
  brandId: string,
  organisationId: string,
  projectId: string,
  dateRangeStart: string,
  dateRangeEnd: string,
  scope?: LifecycleAnalysisInput["scope"],
  userNotes?: string,
): Promise<LifecycleAnalysisInput> {
  const rangeStart = new Date(dateRangeStart);
  const rangeEnd = new Date(dateRangeEnd);
  const now = new Date();

  const [leads, opportunities, tasks, activities] = await Promise.all([
    prisma.crmLead.findMany({
      where: {
        organisationId,
        brandId,
        archivedAt: null,
        ...(scope?.leadIds?.length ? { id: { in: scope.leadIds } } : {}),
        ...(scope?.ownerUserId ? { ownerUserId: scope.ownerUserId } : {}),
        ...(scope?.lifecycleStages?.length
          ? { lifecycleStage: { in: scope.lifecycleStages as Prisma.EnumCrmLifecycleStageFilter["in"] } }
          : {}),
      },
      include: {
        leadScoreSnapshots: { orderBy: { calculatedAt: "desc" }, take: 1 },
        person: { include: { contactMethods: true } },
      },
      take: 500,
    }),
    prisma.crmOpportunity.findMany({
      where: {
        organisationId,
        brandId,
        archivedAt: null,
        ...(scope?.opportunityIds?.length ? { id: { in: scope.opportunityIds } } : {}),
        ...(scope?.pipelineId ? { pipelineId: scope.pipelineId } : {}),
        ...(scope?.ownerUserId ? { ownerUserId: scope.ownerUserId } : {}),
      },
      include: {
        values: { orderBy: { createdAt: "desc" } },
        contactRoles: true,
        currentStage: true,
        stageHistory: { orderBy: { createdAt: "desc" } },
      },
      take: 500,
    }),
    prisma.crmTask.findMany({
      where: {
        organisationId,
        brandId,
        archivedAt: null,
        ...(scope?.leadIds?.length ? { leadId: { in: scope.leadIds } } : {}),
        ...(scope?.opportunityIds?.length ? { opportunityId: { in: scope.opportunityIds } } : {}),
        ...(scope?.ownerUserId ? { ownerUserId: scope.ownerUserId } : {}),
      },
      take: 500,
    }),
    prisma.crmActivity.findMany({
      where: {
        organisationId,
        brandId,
        occurredAt: { gte: rangeStart, lte: rangeEnd },
        ...(scope?.leadIds?.length ? { leadId: { in: scope.leadIds } } : {}),
        ...(scope?.opportunityIds?.length ? { opportunityId: { in: scope.opportunityIds } } : {}),
      },
      orderBy: { occurredAt: "desc" },
      take: 500,
    }),
  ]);

  const leadConsentMap = await loadLeadConsentFlags(leads, organisationId, brandId);

  const mappedLeads = leads.map((lead) => {
    const leadTasks = tasks.filter((t) => t.leadId === lead.id);
    const overdueTaskCount = leadTasks.filter((t) => isTaskOverdue(t)).length;
    const openTaskCount = leadTasks.filter((t) => !["COMPLETED", "CANCELLED"].includes(t.status)).length;
    const consent = leadConsentMap.get(lead.id);
    const snapshot = lead.leadScoreSnapshots[0];

    return {
      id: lead.id,
      status: lead.status,
      lifecycleStage: lead.lifecycleStage,
      ownerUserId: lead.ownerUserId,
      lastActivityAt: lead.lastActivityAt,
      createdAt: lead.createdAt,
      qualificationState: lead.qualificationState,
      leadScore: snapshot?.combinedScore ?? undefined,
      purchaseLikelihoodEstimate: snapshot?.intentScore ? snapshot.intentScore / 100 : undefined,
      churnLikelihoodEstimate: snapshot?.riskScore ? snapshot.riskScore / 100 : undefined,
      suppressed: consent?.suppressed ?? false,
      unsubscribed: consent?.unsubscribed ?? false,
      consentGranted: consent?.consentGranted,
      marketingConsent: consent?.marketingConsent ?? false,
      openTaskCount,
      overdueTaskCount,
    };
  });

  const mappedOpportunities = opportunities.map((opp) => {
    const expected = opp.values.find((v) => v.valueType === "EXPECTED");
    const oppTasks = tasks.filter((t) => t.opportunityId === opp.id);
    const overdueTaskCount = oppTasks.filter((t) => isTaskOverdue(t)).length;
    const openTaskCount = oppTasks.filter((t) => !["COMPLETED", "CANCELLED"].includes(t.status)).length;
    const stageReversalCount = opp.stageHistory.filter(
      (h) => h.previousCategory && h.newCategory && h.previousCategory > h.newCategory,
    ).length;

    return {
      id: opp.id,
      name: opp.name,
      status: opp.status,
      stageCategory: opp.currentStage.category,
      pipelineStage: opp.currentStage.name,
      ownerUserId: opp.ownerUserId,
      expectedValue: expected ? Number(expected.amount) : undefined,
      probability: Number(opp.probability),
      expectedCloseDate: opp.expectedCloseDate,
      lastActivityAt: opp.lastActivityAt,
      stageEnteredAt: opp.stageEnteredAt,
      maxDurationDays: opp.currentStage.maxDurationDays,
      nextAction: opp.nextAction,
      trialEndsAt: null as Date | null,
      renewalDate: null as Date | null,
      hasDecisionMaker: opp.contactRoles.some((r) => r.roleType === "DECISION_MAKER"),
      stageReversalCount,
      overdueTaskCount,
      openTaskCount,
    };
  });

  const latestActivity = activities[0]?.occurredAt ?? leads[0]?.updatedAt ?? null;
  const freshnessHours = latestActivity
    ? Math.round((now.getTime() - latestActivity.getTime()) / 3_600_000)
    : null;

  return {
    analysisDate: now,
    dateRangeStart: rangeStart,
    dateRangeEnd: rangeEnd,
    brandId,
    organisationId,
    projectId,
    scope: scope ?? {},
    leads: mappedLeads,
    opportunities: mappedOpportunities,
    activities: activities.map((a) => ({
      id: a.id,
      leadId: a.leadId ?? undefined,
      opportunityId: a.opportunityId ?? undefined,
      type: a.activityType,
      summary: a.summary,
      occurredAt: a.occurredAt,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      leadId: t.leadId ?? undefined,
      opportunityId: t.opportunityId ?? undefined,
      title: t.title,
      taskTypeCode: t.taskTypeCode,
      status: t.status,
      dueDate: t.dueDate,
      ownerUserId: t.ownerUserId,
    })),
    dataQuality: {
      freshnessHours,
      activityCount: activities.length,
      hasOwnerCoverage: mappedLeads.some((l) => l.ownerUserId !== null),
      warnings: freshnessHours && freshnessHours > 48 ? ["CRM data may be stale"] : [],
    },
    consentContext: {
      marketingConsentRequired: true,
      outreachAllowed: mappedLeads.some((l) => l.marketingConsent && !l.suppressed),
    },
    userNotes,
  };
}

async function loadLeadConsentFlags(
  leads: Array<{ id: string; marketingLeadId: string | null; person?: { contactMethods: Array<{ methodType: string; normalisedValue: string }> } | null }>,
  organisationId: string,
  brandId: string,
) {
  const map = new Map<
    string,
    { suppressed: boolean; unsubscribed: boolean; consentGranted?: boolean; marketingConsent: boolean }
  >();

  for (const lead of leads) {
    let suppressed = false;
    let marketingConsent = false;

    if (lead.marketingLeadId) {
      const consent = await prisma.leadConsent.findFirst({
        where: { marketingLeadId: lead.marketingLeadId, organisationId, brandId },
        orderBy: { recordedAt: "desc" },
      });
      marketingConsent = consent?.marketingOptIn ?? false;
      suppressed = consent?.suppressed ?? false;
    }

    const email = lead.person?.contactMethods.find((m) => m.methodType === "EMAIL")?.normalisedValue;
    if (email) {
      const emailSuppression = await prisma.emailSuppression.findFirst({
        where: { organisationId, emailAddress: normaliseEmailAddress(email) },
      });
      if (emailSuppression) suppressed = true;
    }

    map.set(lead.id, {
      suppressed,
      unsubscribed: !marketingConsent && !!lead.marketingLeadId,
      consentGranted: marketingConsent && !suppressed,
      marketingConsent,
    });
  }

  return map;
}

async function createRecommendationWithActions(
  tx: Prisma.TransactionClient,
  runId: string,
  findingId: string | null,
  rec: {
    recommendationType: string;
    title: string;
    description: string;
    priorityScore: number;
    priorityBand: string;
    requiresApproval: boolean;
    rationale?: string;
  },
  actionProposals: Array<{
    recommendationType: string;
    actionClass: string;
    title: string;
    description: string;
    evaluation: ReturnType<typeof evaluateActionProposal>;
  }>,
) {
  const recommendation = await tx.lifecycleAgentRecommendation.create({
    data: {
      runId,
      findingId,
      recommendationType: mapRecommendationType(rec.recommendationType),
      title: rec.title,
      description: rec.description,
      priorityScore: rec.priorityScore,
      rationale: rec.rationale ?? `Priority band: ${rec.priorityBand}`,
      requiresApproval: rec.requiresApproval,
    },
  });

  const action =
    actionProposals.find((a) => a.recommendationType === rec.recommendationType) ?? {
      actionClass: mapRecommendationToActionClass(rec.recommendationType),
      title: rec.title,
      description: rec.description,
      evaluation: evaluateActionProposal({
        actionClass: mapRecommendationToActionClass(rec.recommendationType),
        title: rec.title,
        description: rec.description,
        fromLlmOutput: true,
      }),
    };

  const actionType = ACTION_CLASS_MAP[action.actionClass] ?? "CREATE_TASK";

  await tx.lifecycleAgentActionProposal.create({
    data: {
      recommendationId: recommendation.id,
      actionType,
      payload: { actionClass: action.actionClass, priorityBand: rec.priorityBand } as Prisma.InputJsonValue,
      requiresApproval: action.evaluation.requiresApproval,
      status: action.evaluation.status === "BLOCKED" ? "REJECTED" : "PENDING",
    },
  });

  return recommendation;
}
