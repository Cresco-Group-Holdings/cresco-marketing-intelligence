import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { validateActionConfig } from "@/lib/automation-engine/actions";
import { evaluateAllConditions } from "@/lib/automation-engine/conditions";
import { buildDefinitionHash } from "@/lib/automation-engine/safety";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";

const versionInclude = {
  triggers: true,
  conditions: { orderBy: { sortOrder: "asc" as const } },
  actions: { orderBy: { sortOrder: "asc" as const } },
} satisfies Prisma.AutomationVersionInclude;

const workflowInclude = {
  activeVersion: { include: versionInclude },
  versions: { orderBy: { versionNumber: "desc" as const }, take: 10, include: versionInclude },
} satisfies Prisma.AutomationWorkflowInclude;

export const automationEngineService = {
  async listWorkflows(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.automationWorkflow.findMany({
      where: { organisationId, brandId, archivedAt: null },
      include: workflowInclude,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  },

  async getWorkflow(workflowId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const workflow = await prisma.automationWorkflow.findFirst({
      where: { id: workflowId, organisationId, brandId },
      include: workflowInclude,
    });
    if (!workflow) throw new AppError("NOT_FOUND", "Automation workflow not found.");
    return workflow;
  },

  async createWorkflow(
    brandId: string,
    organisationId: string,
    input: { name: string; description?: string; executionLimitPerDay?: number; monthlyQuota?: number },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    return prisma.$transaction(async (tx) => {
      const workflow = await tx.automationWorkflow.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          name: input.name,
          description: input.description,
          executionLimitPerDay: input.executionLimitPerDay,
          monthlyQuota: input.monthlyQuota,
          createdByUserId: context.userProfileId,
        },
      });
      const version = await tx.automationVersion.create({
        data: { workflowId: workflow.id, versionNumber: 1, status: "DRAFT" },
      });
      return tx.automationWorkflow.update({
        where: { id: workflow.id },
        data: { activeVersionId: version.id },
        include: workflowInclude,
      });
    });
  },

  async saveVersion(
    brandId: string,
    organisationId: string,
    input: {
      workflowId: string;
      notes?: string;
      triggers: Array<{
        triggerKind: string;
        eventType?: string;
        scheduleCron?: string;
        config?: Record<string, unknown>;
        isEnabled?: boolean;
      }>;
      conditions: Array<{ field: string; operator: string; value?: unknown; sortOrder?: number }>;
      actions: Array<{
        actionType: string;
        config: Record<string, unknown>;
        sortOrder?: number;
        maxRetries?: number;
        idempotencyKeyTemplate?: string;
      }>;
    },
    context: TenantContext,
  ) {
    const workflow = await this.getWorkflow(input.workflowId, brandId, organisationId, context);
    if (workflow.status === "ARCHIVED") {
      throw new AppError("VALIDATION_ERROR", "Cannot edit an archived workflow.");
    }

    for (const action of input.actions) {
      const check = validateActionConfig(
        action.actionType as Parameters<typeof validateActionConfig>[0],
        action.config,
      );
      if (!check.valid) throw new AppError("VALIDATION_ERROR", check.errors.join(" "));
    }

    const definitionHash = buildDefinitionHash({
      triggers: input.triggers,
      conditions: input.conditions,
      actions: input.actions,
    });

    const latestVersion = workflow.versions[0]?.versionNumber ?? 0;
    const version = await prisma.$transaction(async (tx) => {
      const created = await tx.automationVersion.create({
        data: {
          workflowId: workflow.id,
          versionNumber: latestVersion + 1,
          status: "DRAFT",
          definitionHash,
          notes: input.notes,
        },
      });

      for (const trigger of input.triggers) {
        await tx.automationTrigger.create({
          data: {
            versionId: created.id,
            triggerKind: trigger.triggerKind as Prisma.AutomationTriggerCreateInput["triggerKind"],
            eventType: trigger.eventType as Prisma.AutomationTriggerCreateInput["eventType"],
            scheduleCron: trigger.scheduleCron,
            config: trigger.config as Prisma.InputJsonValue,
            isEnabled: trigger.isEnabled ?? true,
          },
        });
      }

      for (const [index, condition] of input.conditions.entries()) {
        await tx.automationCondition.create({
          data: {
            versionId: created.id,
            field: condition.field,
            operator: condition.operator,
            value: condition.value as Prisma.InputJsonValue,
            sortOrder: condition.sortOrder ?? index,
          },
        });
      }

      for (const [index, action] of input.actions.entries()) {
        await tx.automationAction.create({
          data: {
            versionId: created.id,
            actionType: action.actionType as Prisma.AutomationActionCreateInput["actionType"],
            config: action.config as Prisma.InputJsonValue,
            sortOrder: action.sortOrder ?? index,
            maxRetries: action.maxRetries ?? 3,
            idempotencyKeyTemplate: action.idempotencyKeyTemplate,
          },
        });
      }

      await tx.automationWorkflow.update({
        where: { id: workflow.id },
        data: { activeVersionId: created.id, updatedByUserId: context.userProfileId },
      });

      return created;
    });

    await recordAuditEvent({
      organisationId,
      projectId: workflow.projectId,
      actorUserId: context.userProfileId,
      action: "automationEngine.version_saved",
      resourceType: "AutomationWorkflow",
      resourceId: workflow.id,
      metadata: { versionId: version.id, definitionHash },
    });

    return this.getWorkflow(workflow.id, brandId, organisationId, context);
  },

  async activateWorkflow(workflowId: string, brandId: string, organisationId: string, context: TenantContext) {
    const workflow = await this.getWorkflow(workflowId, brandId, organisationId, context);
    if (!workflow.activeVersion) throw new AppError("VALIDATION_ERROR", "Workflow has no active version.");
    if (workflow.activeVersion.actions.length === 0) {
      throw new AppError("VALIDATION_ERROR", "Workflow must have at least one action.");
    }

    return prisma.$transaction(async (tx) => {
      await tx.automationVersion.update({
        where: { id: workflow.activeVersionId! },
        data: { status: "ACTIVE", publishedAt: new Date() },
      });
      return tx.automationWorkflow.update({
        where: { id: workflowId },
        data: { status: "ACTIVE", updatedByUserId: context.userProfileId },
        include: workflowInclude,
      });
    });
  },

  async pauseWorkflow(workflowId: string, brandId: string, organisationId: string, context: TenantContext) {
    await this.getWorkflow(workflowId, brandId, organisationId, context);
    return prisma.automationWorkflow.update({
      where: { id: workflowId },
      data: { status: "PAUSED", updatedByUserId: context.userProfileId },
      include: workflowInclude,
    });
  },

  async listExecutions(
    workflowId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
    limit = 50,
  ) {
    await this.getWorkflow(workflowId, brandId, organisationId, context);
    return prisma.automationExecution.findMany({
      where: { workflowId, organisationId, brandId },
      include: { steps: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  async dryRunVersion(
    workflowId: string,
    brandId: string,
    organisationId: string,
    payload: Record<string, unknown>,
    context: TenantContext,
  ) {
    const workflow = await this.getWorkflow(workflowId, brandId, organisationId, context);
    const version = workflow.activeVersion;
    if (!version) throw new AppError("VALIDATION_ERROR", "No active version to dry-run.");

    const conditions = version.conditions.map((c) => ({
      field: c.field,
      operator: c.operator,
      value: c.value,
    }));
    const passes = evaluateAllConditions(conditions, payload);

    return {
      workflowId,
      versionId: version.id,
      conditionsPass: passes,
      plannedActions: passes
        ? version.actions.map((a) => ({
            actionType: a.actionType,
            config: a.config,
            sortOrder: a.sortOrder,
          }))
        : [],
    };
  },
};
