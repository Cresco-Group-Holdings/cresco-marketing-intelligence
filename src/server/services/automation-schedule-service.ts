import { prisma } from "@/lib/database/prisma";
import { cronMatches, idempotencyKeyForScheduledRun } from "@/lib/background/scheduling";
import { checkDailyExecutionLimit, checkMonthlyQuota, dayStart, monthStart } from "@/lib/automation-engine/safety";
import { evaluateAllConditions } from "@/lib/automation-engine/conditions";
import { logger } from "@/lib/logging";

const DEFAULT_TIMEZONE = "Europe/London";

export type ScheduleDispatchSummary = {
  evaluated: number;
  triggered: number;
  skipped: number;
  executionIds: string[];
};

export const automationScheduleService = {
  async dispatchDueSchedules(now: Date, limit = 50): Promise<ScheduleDispatchSummary> {
    const workflows = await prisma.automationWorkflow.findMany({
      where: {
        status: "ACTIVE",
        archivedAt: null,
        organisation: { status: "ACTIVE", archivedAt: null },
      },
      include: {
        activeVersion: {
          include: {
            triggers: { where: { isEnabled: true, triggerKind: "SCHEDULE" } },
            conditions: { orderBy: { sortOrder: "asc" } },
            actions: { orderBy: { sortOrder: "asc" } },
          },
        },
      },
      take: limit * 2,
    });

    const summary: ScheduleDispatchSummary = {
      evaluated: 0,
      triggered: 0,
      skipped: 0,
      executionIds: [],
    };

    for (const workflow of workflows) {
      const version = workflow.activeVersion;
      if (!version) continue;

      for (const trigger of version.triggers) {
        if (!trigger.scheduleCron) continue;
        summary.evaluated += 1;

        const timezone =
          (trigger.config as { timezone?: string } | null)?.timezone ??
          DEFAULT_TIMEZONE;

        if (!cronMatches(trigger.scheduleCron, now, timezone)) {
          summary.skipped += 1;
          continue;
        }

        const windowStart = new Date(now);
        windowStart.setSeconds(0, 0);
        const idempotencyKey = idempotencyKeyForScheduledRun(workflow.id, windowStart);

        const existing = await prisma.automationExecution.findUnique({
          where: { workflowId_idempotencyKey: { workflowId: workflow.id, idempotencyKey } },
        });
        if (existing) {
          summary.skipped += 1;
          continue;
        }

        const payload = {
          resourceType: "schedule",
          resourceId: workflow.id,
          triggerKind: "SCHEDULE",
          scheduleCron: trigger.scheduleCron,
          timezone,
        };

        const conditions = version.conditions.map((c) => ({
          field: c.field,
          operator: c.operator,
          value: c.value,
        }));
        if (!evaluateAllConditions(conditions, payload)) {
          summary.skipped += 1;
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
          summary.skipped += 1;
          continue;
        }

        const period = monthStart();
        const quota = await prisma.automationQuotaUsage.upsert({
          where: {
            organisationId_brandId_periodStart: {
              organisationId: workflow.organisationId,
              brandId: workflow.brandId,
              periodStart: period,
            },
          },
          create: {
            organisationId: workflow.organisationId,
            brandId: workflow.brandId,
            periodStart: period,
            executionCount: 0,
          },
          update: {},
        });
        const quotaCheck = checkMonthlyQuota(quota.executionCount, workflow.monthlyQuota);
        if (!quotaCheck.allowed) {
          summary.skipped += 1;
          continue;
        }

        const execution = await prisma.automationExecution.create({
          data: {
            workflowId: workflow.id,
            versionId: version.id,
            organisationId: workflow.organisationId,
            projectId: workflow.projectId,
            brandId: workflow.brandId,
            idempotencyKey,
            triggerEventType: "MANUAL",
            triggerPayload: payload,
            status: "PENDING",
            triggeredByUserId: workflow.createdByUserId,
          },
        });

        await prisma.automationQuotaUsage.update({
          where: { id: quota.id },
          data: { executionCount: { increment: 1 } },
        });

        summary.triggered += 1;
        summary.executionIds.push(execution.id);

        logger.info("automation.schedule_triggered", {
          workflowId: workflow.id,
          executionId: execution.id,
          scheduleCron: trigger.scheduleCron,
        });
      }
    }

    return summary;
  },

  async activateTemplate(input: {
    templateKey: string;
    brandId: string;
    organisationId: string;
    userProfileId: string;
    timezone?: string;
  }) {
    const { getLaunchTemplate } = await import("@/lib/automation-engine/launch-templates");
    const template = getLaunchTemplate(input.templateKey);
    if (!template) {
      throw new Error(`Unknown automation template: ${input.templateKey}`);
    }

    const brand = await prisma.brand.findFirst({
      where: { id: input.brandId, organisationId: input.organisationId },
      select: { id: true, projectId: true },
    });
    if (!brand) {
      throw new Error("Brand not found for tenant.");
    }

    const existing = await prisma.automationWorkflow.findFirst({
      where: {
        organisationId: input.organisationId,
        brandId: input.brandId,
        name: template.name,
        archivedAt: null,
      },
    });
    if (existing) {
      return existing;
    }

    const workflow = await prisma.$transaction(async (tx) => {
      const created = await tx.automationWorkflow.create({
        data: {
          organisationId: input.organisationId,
          projectId: brand.projectId,
          brandId: input.brandId,
          name: template.name,
          description: template.description,
          status: "DRAFT",
          createdByUserId: input.userProfileId,
        },
      });
      const version = await tx.automationVersion.create({
        data: { workflowId: created.id, versionNumber: 1, status: "DRAFT" },
      });

      await tx.automationTrigger.create({
        data: {
          versionId: version.id,
          triggerKind: template.triggerKind,
          eventType: template.eventType,
          scheduleCron: template.scheduleCron,
          config: { timezone: input.timezone ?? "Europe/London", templateKey: template.key },
          isEnabled: true,
        },
      });

      for (const [index, condition] of template.conditions.entries()) {
        await tx.automationCondition.create({
          data: {
            versionId: version.id,
            field: condition.field,
            operator: condition.operator,
            value: condition.value,
            sortOrder: index,
          },
        });
      }

      for (const [index, action] of template.actions.entries()) {
        await tx.automationAction.create({
          data: {
            versionId: version.id,
            actionType: action.actionType,
            config: action.config,
            sortOrder: index,
            maxRetries: action.maxRetries ?? 3,
          },
        });
      }

      await tx.automationVersion.update({
        where: { id: version.id },
        data: { status: "ACTIVE", publishedAt: new Date() },
      });

      return tx.automationWorkflow.update({
        where: { id: created.id },
        data: { activeVersionId: version.id, status: "ACTIVE" },
      });
    });

    return workflow;
  },
};
