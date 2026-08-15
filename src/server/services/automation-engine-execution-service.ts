import type { AutomationActionType, OrganisationRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { buildDryRunPlan, canTransitionCampaignStatus, validateActionConfig } from "@/lib/automation-engine/actions";
import { evaluateAllConditions } from "@/lib/automation-engine/conditions";
import {
  buildIdempotencyKey,
  canTriggerWorkflow,
  checkDailyExecutionLimit,
  checkMonthlyQuota,
  dayStart,
  monthStart,
  shouldDeadLetter,
} from "@/lib/automation-engine/safety";
import { matchesEventTrigger } from "@/lib/automation-engine/triggers";
import { MAX_ACTIONS_PER_EXECUTION } from "@/lib/automation-engine/constants";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { crmActivityService } from "@/server/services/crm-activity-service";
import { crmService } from "@/server/services/crm-service";
import { crmTaskService } from "@/server/services/crm-task-service";
import { notificationService } from "@/server/services/notification-service";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";

type ActionContext = {
  organisationId: string;
  projectId: string;
  brandId: string;
  userProfileId: string;
  payload: Record<string, unknown>;
  dryRun: boolean;
};

async function executeAction(
  actionType: AutomationActionType,
  config: Record<string, unknown>,
  ctx: ActionContext,
): Promise<Record<string, unknown>> {
  if (ctx.dryRun) {
    return { dryRun: true, actionType, configKeys: Object.keys(config) };
  }

  const tenant: TenantContext = {
    userId: ctx.userProfileId,
    userProfileId: ctx.userProfileId,
    organisationId: ctx.organisationId,
    organisationRole: "OWNER" as OrganisationRole,
  };

  switch (actionType) {
    case "CREATE_TASK": {
      const task = await crmTaskService.createTask(
        ctx.brandId,
        ctx.organisationId,
        {
          title: String(config.title),
          description: config.description ? String(config.description) : undefined,
          taskTypeCode: (config.taskTypeCode as "FOLLOW_UP") ?? "FOLLOW_UP",
          ownerUserId: config.ownerUserId ? String(config.ownerUserId) : ctx.userProfileId,
          leadId: config.leadId ? String(config.leadId) : (ctx.payload.leadId as string | undefined),
          campaignId: config.campaignId ? String(config.campaignId) : undefined,
        },
        tenant,
      );
      return { taskId: task.id };
    }
    case "UPDATE_CAMPAIGN_STATUS": {
      const campaign = await prisma.contentCampaign.findFirst({
        where: { id: String(config.campaignId), organisationId: ctx.organisationId, brandId: ctx.brandId },
      });
      if (!campaign) throw new AppError("NOT_FOUND", "Campaign not found.");
      const nextStatus = String(config.status);
      if (!canTransitionCampaignStatus(campaign.status, nextStatus)) {
        throw new AppError("VALIDATION_ERROR", `Cannot transition campaign from ${campaign.status} to ${nextStatus}.`);
      }
      const updated = await prisma.contentCampaign.update({
        where: { id: campaign.id },
        data: { status: nextStatus as Prisma.ContentCampaignUpdateInput["status"] },
      });
      return { campaignId: updated.id, status: updated.status };
    }
    case "ASSIGN_USER": {
      const userId = String(config.userId);
      const resourceType = String(config.resourceType);
      const resourceId = String(config.resourceId);
      if (resourceType === "LEAD") {
        await crmService.assignOwner(resourceId, ctx.brandId, ctx.organisationId, userId, tenant);
        return { resourceType, resourceId, userId };
      }
      if (resourceType === "TASK") {
        await prisma.crmTask.update({
          where: { id: resourceId },
          data: { ownerUserId: userId },
        });
        return { resourceType, resourceId, userId };
      }
      if (resourceType === "CAMPAIGN") {
        await prisma.contentCampaign.update({
          where: { id: resourceId },
          data: { ownerUserId: userId },
        });
        return { resourceType, resourceId, userId };
      }
      throw new AppError("VALIDATION_ERROR", `Unsupported assign resource type: ${resourceType}`);
    }
    case "REQUEST_APPROVAL": {
      const approverUserId = String(config.approverUserId);
      const contentItemId = config.contentItemId ? String(config.contentItemId) : undefined;
      if (contentItemId) {
        const approval = await prisma.contentApproval.create({
          data: {
            organisationId: ctx.organisationId,
            projectId: ctx.projectId,
            brandId: ctx.brandId,
            contentItemId,
            approvalMode: "ONE_APPROVER",
            requestedByUserId: ctx.userProfileId,
            approverUserId,
          },
        });
        return { approvalId: approval.id };
      }
      await notificationService.emit({
        organisationId: ctx.organisationId,
        projectId: ctx.projectId,
        brandId: ctx.brandId,
        eventType: "APPROVAL_REQUESTED",
        title: String(config.title ?? "Approval requested"),
        body: String(config.body ?? "An automation workflow requested approval."),
        recipientUserIds: [approverUserId],
        idempotencyKey: `automation-approval:${ctx.brandId}:${approverUserId}:${Date.now()}`,
      });
      return { notified: approverUserId };
    }
    case "CREATE_NOTIFICATION": {
      const recipientUserIds = (config.recipientUserIds as string[]) ?? [];
      await notificationService.emit({
        organisationId: ctx.organisationId,
        projectId: ctx.projectId,
        brandId: ctx.brandId,
        eventType: String(config.eventType ?? "SYSTEM"),
        title: String(config.title),
        body: String(config.body ?? ""),
        recipientUserIds,
        actionPath: config.actionPath ? String(config.actionPath) : undefined,
        idempotencyKey: String(config.idempotencyKey ?? `automation-notify:${Date.now()}`),
      });
      return { recipientCount: recipientUserIds.length };
    }
    case "ADD_CRM_ACTIVITY": {
      const activity = await crmActivityService.logActivity(
        ctx.brandId,
        ctx.organisationId,
        {
          activityType: (config.activityType as "NOTE") ?? "NOTE",
          title: String(config.title),
          summary: config.summary ? String(config.summary) : undefined,
          leadId: config.leadId ? String(config.leadId) : (ctx.payload.leadId as string | undefined),
          campaignId: config.campaignId ? String(config.campaignId) : undefined,
        },
        tenant,
      );
      return { activityId: activity.id };
    }
    case "UPDATE_LEAD_STATUS": {
      const leadId = String(config.leadId ?? ctx.payload.leadId);
      const lead = await crmService.updateLeadStatus(
        leadId,
        ctx.brandId,
        ctx.organisationId,
        String(config.status),
        config.reason ? String(config.reason) : "Automation workflow",
        tenant,
      );
      return { leadId: lead.id, status: lead.status };
    }
    case "CREATE_CALENDAR_EVENT": {
      const activity = await crmActivityService.logActivity(
        ctx.brandId,
        ctx.organisationId,
        {
          activityType: "MEETING",
          title: String(config.title),
          leadId: config.leadId ? String(config.leadId) : (ctx.payload.leadId as string | undefined),
          meeting: {
            scheduledAt: String(config.scheduledAt),
            durationMinutes: config.durationMinutes ? Number(config.durationMinutes) : 30,
            location: config.location ? String(config.location) : undefined,
          },
        },
        tenant,
      );
      return { activityId: activity.id };
    }
    default:
      throw new AppError("VALIDATION_ERROR", `Unsupported action type: ${actionType}`);
  }
}

export const automationEngineExecutionService = {
  async dispatchEvent(
    brandId: string,
    organisationId: string,
    input: {
      eventType: string;
      payload: Record<string, unknown>;
      dryRun?: boolean;
      idempotencyKey?: string;
      triggerDepth?: number;
      sourceWorkflowId?: string;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const workflows = await prisma.automationWorkflow.findMany({
      where: {
        organisationId,
        brandId,
        status: "ACTIVE",
        archivedAt: null,
        activeVersionId: { not: null },
      },
      include: {
        activeVersion: {
          include: {
            triggers: { where: { isEnabled: true } },
            conditions: { orderBy: { sortOrder: "asc" } },
            actions: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });

    const results = [];
    for (const workflow of workflows) {
      const version = workflow.activeVersion;
      if (!version) continue;

      const matchingTrigger = version.triggers.find(
        (t) =>
          t.triggerKind === "EVENT" &&
          matchesEventTrigger(t.eventType, input.eventType as Parameters<typeof matchesEventTrigger>[1]),
      );
      if (!matchingTrigger) continue;

      const loopCheck = canTriggerWorkflow({
        preventSelfTrigger: workflow.preventSelfTrigger,
        triggerDepth: input.triggerDepth ?? 0,
        sourceWorkflowId: input.sourceWorkflowId,
        targetWorkflowId: workflow.id,
        eventType: input.eventType,
      });
      if (!loopCheck.allowed) {
        results.push({ workflowId: workflow.id, status: "SKIPPED", reason: loopCheck.reason });
        continue;
      }

      const resourceId = String(input.payload.resourceId ?? input.payload.leadId ?? input.payload.campaignId ?? "event");
      const idempotencyKey =
        input.idempotencyKey ?? buildIdempotencyKey(workflow.id, input.eventType, resourceId);

      const existing = await prisma.automationExecution.findUnique({
        where: { workflowId_idempotencyKey: { workflowId: workflow.id, idempotencyKey } },
      });
      if (existing) {
        results.push({ workflowId: workflow.id, status: "SKIPPED", reason: "Duplicate idempotency key.", executionId: existing.id });
        continue;
      }

      const conditions = version.conditions.map((c) => ({
        field: c.field,
        operator: c.operator,
        value: c.value,
      }));
      if (!evaluateAllConditions(conditions, input.payload)) {
        results.push({ workflowId: workflow.id, status: "SKIPPED", reason: "Conditions not met." });
        continue;
      }

      const dailyCount = await prisma.automationExecution.count({
        where: {
          workflowId: workflow.id,
          createdAt: { gte: dayStart() },
          status: { notIn: ["SKIPPED", "DRY_RUN"] },
        },
      });
      const dailyCheck = checkDailyExecutionLimit(dailyCount, workflow.executionLimitPerDay);
      if (!dailyCheck.allowed) {
        results.push({ workflowId: workflow.id, status: "SKIPPED", reason: dailyCheck.reason });
        continue;
      }

      const period = monthStart();
      const quota = await prisma.automationQuotaUsage.upsert({
        where: {
          organisationId_brandId_periodStart: {
            organisationId,
            brandId,
            periodStart: period,
          },
        },
        create: { organisationId, brandId, periodStart: period, executionCount: 0 },
        update: {},
      });
      const quotaCheck = checkMonthlyQuota(quota.executionCount, workflow.monthlyQuota);
      if (!quotaCheck.allowed) {
        results.push({ workflowId: workflow.id, status: "SKIPPED", reason: quotaCheck.reason });
        continue;
      }

      const execution = await this.runExecution({
        workflowId: workflow.id,
        versionId: version.id,
        organisationId,
        projectId: brand.projectId,
        brandId,
        idempotencyKey,
        eventType: input.eventType,
        payload: input.payload,
        dryRun: input.dryRun ?? false,
        triggerDepth: input.triggerDepth ?? 0,
        userProfileId: context.userProfileId,
        actions: version.actions,
      });

      if (!input.dryRun) {
        await prisma.automationQuotaUsage.update({
          where: { id: quota.id },
          data: { executionCount: { increment: 1 } },
        });
      }

      results.push(execution);
    }

    return { results };
  },

  async runExecution(input: {
    workflowId: string;
    versionId: string;
    organisationId: string;
    projectId: string;
    brandId: string;
    idempotencyKey: string;
    eventType: string;
    payload: Record<string, unknown>;
    dryRun: boolean;
    triggerDepth: number;
    userProfileId: string;
    actions: Array<{
      id: string;
      actionType: AutomationActionType;
      config: Prisma.JsonValue;
      sortOrder: number;
      maxRetries: number;
    }>;
  }) {
    const execution = await prisma.automationExecution.create({
      data: {
        workflowId: input.workflowId,
        versionId: input.versionId,
        organisationId: input.organisationId,
        projectId: input.projectId,
        brandId: input.brandId,
        idempotencyKey: input.idempotencyKey,
        triggerEventType: input.eventType as Prisma.AutomationExecutionCreateInput["triggerEventType"],
        triggerPayload: input.payload as Prisma.InputJsonValue,
        dryRun: input.dryRun,
        triggerDepth: input.triggerDepth,
        triggeredByUserId: input.userProfileId,
        status: input.dryRun ? "DRY_RUN" : "RUNNING",
        startedAt: new Date(),
      },
    });

    if (input.dryRun) {
      const plan = buildDryRunPlan(
        input.actions.map((a) => ({
          actionType: a.actionType,
          config: a.config as Record<string, unknown>,
        })),
      );
      await prisma.automationExecution.update({
        where: { id: execution.id },
        data: { status: "DRY_RUN", completedAt: new Date() },
      });
      return { workflowId: input.workflowId, executionId: execution.id, status: "DRY_RUN", plan };
    }

    const actionCtx: ActionContext = {
      organisationId: input.organisationId,
      projectId: input.projectId,
      brandId: input.brandId,
      userProfileId: input.userProfileId,
      payload: input.payload,
      dryRun: false,
    };

    const actionsToRun = input.actions.slice(0, MAX_ACTIONS_PER_EXECUTION);
    let failed = false;
    let errorMessage: string | undefined;

    for (const action of actionsToRun) {
      const config = action.config as Record<string, unknown>;
      const validation = validateActionConfig(action.actionType, config);
      if (!validation.valid) {
        failed = true;
        errorMessage = validation.errors.join(" ");
        break;
      }

      const step = await prisma.automationExecutionStep.create({
        data: { executionId: execution.id, actionId: action.id, status: "RUNNING", startedAt: new Date() },
      });

      let attempt = 0;
      let stepCompleted = false;
      while (attempt < action.maxRetries && !stepCompleted) {
        attempt += 1;
        try {
          const result = await executeAction(action.actionType, config, actionCtx);
          await prisma.automationExecutionStep.update({
            where: { id: step.id },
            data: {
              status: "COMPLETED",
              attemptCount: attempt,
              result: result as Prisma.InputJsonValue,
              completedAt: new Date(),
            },
          });
          stepCompleted = true;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Action failed.";
          if (attempt >= action.maxRetries) {
            await prisma.automationExecutionStep.update({
              where: { id: step.id },
              data: {
                status: "FAILED",
                attemptCount: attempt,
                errorMessage: message,
                completedAt: new Date(),
              },
            });
            failed = true;
            errorMessage = message;
          } else {
            await prisma.automationExecutionStep.update({
              where: { id: step.id },
              data: { status: "RETRYING", attemptCount: attempt, errorMessage: message },
            });
          }
        }
      }
      if (failed) break;
    }

    const finalStatus = failed
      ? shouldDeadLetter(execution.attemptCount + 1, execution.maxAttempts)
        ? "DEAD_LETTER"
        : "FAILED"
      : "COMPLETED";

    const updated = await prisma.automationExecution.update({
      where: { id: execution.id },
      data: {
        status: finalStatus,
        errorMessage,
        deadLetterAt: finalStatus === "DEAD_LETTER" ? new Date() : null,
        completedAt: new Date(),
        attemptCount: { increment: 1 },
      },
    });

    await recordAuditEvent({
      organisationId: input.organisationId,
      projectId: input.projectId,
      actorUserId: input.userProfileId,
      action: "automationEngine.execution_completed",
      resourceType: "AutomationWorkflow",
      resourceId: input.workflowId,
      metadata: { executionId: execution.id, status: finalStatus },
    });

    return { workflowId: input.workflowId, executionId: updated.id, status: finalStatus, errorMessage };
  },

  async manualExecute(
    workflowId: string,
    brandId: string,
    organisationId: string,
    payload: Record<string, unknown>,
    context: TenantContext,
    dryRun = false,
  ) {
    return this.dispatchEvent(
      brandId,
      organisationId,
      {
        eventType: "MANUAL",
        payload: { ...payload, resourceId: workflowId },
        dryRun,
        sourceWorkflowId: workflowId,
      },
      context,
    );
  },
};
