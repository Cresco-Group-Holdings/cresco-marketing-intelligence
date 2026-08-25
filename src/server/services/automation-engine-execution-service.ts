import type { AutomationActionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { buildDryRunPlan, validateActionConfig } from "@/lib/automation-engine/actions";
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
import { recordAuditEvent } from "@/server/services/audit-service";
import { automationActionExecutor } from "@/server/services/automation-action-executor";
import { brandService } from "@/server/services/workspace-service";
import { isCommercialUsageExempt } from "@/lib/billing/commercial-exempt";
import { ENTITLEMENT_KEYS, USAGE_METER_KEYS } from "@/lib/billing/entitlements";
import { entitlementService } from "@/server/services/entitlement-service";
import { usageMeteringService } from "@/server/services/usage-metering-service";

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
  return automationActionExecutor.execute(actionType, config, ctx);
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

      if (!input.dryRun && !isCommercialUsageExempt(organisationId)) {
        await entitlementService.assert({
          workspaceId: organisationId,
          organisationId,
          entitlement: ENTITLEMENT_KEYS.AUTOMATION_EXECUTIONS_MONTHLY,
          requestedAmount: 1,
        });
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

    if (!input.dryRun && finalStatus === "COMPLETED") {
      await usageMeteringService.recordUsage({
        organisationId: input.organisationId,
        meterKey: USAGE_METER_KEYS.AUTOMATION_EXECUTIONS,
        amount: 1,
        idempotencyKey: `automation-execution-${execution.id}`,
        period: "BILLING_PERIOD",
      });
    }

    return { workflowId: input.workflowId, executionId: updated.id, status: finalStatus, errorMessage };
  },

  async resumePendingExecution(executionId: string, organisationId: string) {
    const execution = await prisma.automationExecution.findFirst({
      where: { id: executionId, organisationId },
      include: {
        version: {
          include: {
            actions: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });
    if (!execution) {
      throw new AppError("NOT_FOUND", "Automation execution not found.");
    }
    if (execution.status !== "PENDING" && execution.status !== "FAILED") {
      return {
        workflowId: execution.workflowId,
        executionId: execution.id,
        status: execution.status,
        skipped: true as const,
      };
    }

    const actions = execution.version.actions;
    const payload = (execution.triggerPayload as Record<string, unknown> | null) ?? {};
    const userProfileId = execution.triggeredByUserId ?? execution.workflowId;

    await prisma.automationExecution.update({
      where: { id: execution.id },
      data: { status: "RUNNING", startedAt: execution.startedAt ?? new Date() },
    });

    const actionCtx: ActionContext = {
      organisationId: execution.organisationId,
      projectId: execution.projectId,
      brandId: execution.brandId,
      userProfileId,
      payload,
      dryRun: false,
    };

    const actionsToRun = actions.slice(0, MAX_ACTIONS_PER_EXECUTION);
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
      organisationId: execution.organisationId,
      projectId: execution.projectId,
      actorUserId: userProfileId,
      action: "automationEngine.execution_completed",
      resourceType: "AutomationWorkflow",
      resourceId: execution.workflowId,
      metadata: { executionId: execution.id, status: finalStatus, resumed: true },
    });

    return {
      workflowId: execution.workflowId,
      executionId: updated.id,
      status: finalStatus,
      errorMessage,
      skipped: false as const,
    };
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
