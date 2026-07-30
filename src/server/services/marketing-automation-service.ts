import type {
  MarketingAutomationNodeType,
  MarketingAutomationRepeatPolicy,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { computeAutomationAnalytics } from "@/lib/marketing-automation/analytics";
import {
  evaluateRequiredApprovals,
  hashGraphComponents,
  isApprovalValid,
} from "@/lib/marketing-automation/approval";
import { validateActionConfig } from "@/lib/marketing-automation/actions";
import { validateDelayConfig } from "@/lib/marketing-automation/delays";
import {
  type AutomationGraph,
  validateAutomationGraph,
} from "@/lib/marketing-automation/graph-validation";
import { validateGraphSafety } from "@/lib/marketing-automation/safety";
import { JOURNEY_TEMPLATES, listJourneyTemplates } from "@/lib/marketing-automation/templates";
import { validateTriggerConfig } from "@/lib/marketing-automation/triggers";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";
import { recordAuditEvent } from "@/server/services/audit-service";

const versionInclude = {
  triggers: true,
  nodes: {
    include: {
      condition: true,
      delay: true,
      goal: true,
      outgoingEdges: true,
      incomingEdges: true,
    },
  },
  edges: { include: { sourceNode: true, targetNode: true } },
  goals: true,
  exitRules: true,
  approvals: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.MarketingAutomationVersionInclude;

const automationInclude = {
  versions: { orderBy: { versionNumber: "desc" as const }, take: 1, include: versionInclude },
  activeVersion: { include: versionInclude },
} satisfies Prisma.MarketingAutomationInclude;

type SaveGraphNodeInput = {
  nodeKey: string;
  nodeType: MarketingAutomationNodeType;
  label?: string;
  positionX?: number;
  positionY?: number;
  config?: Prisma.InputJsonValue;
  condition?: { field: string; operator: string; value?: Prisma.InputJsonValue };
  delay?: {
    delayType: string;
    durationMinutes?: number;
    untilAt?: string;
    timezone?: string;
    businessDaysOnly?: boolean;
    daypartStart?: string;
    daypartEnd?: string;
    waitEventType?: string;
    maxWaitMinutes?: number;
    config?: Prisma.InputJsonValue;
  };
  goal?: { goalType: string; config?: Prisma.InputJsonValue };
};

type SaveGraphInput = {
  nodes: SaveGraphNodeInput[];
  edges: Array<{ sourceNodeKey: string; targetNodeKey: string; branchLabel?: string }>;
  triggers: Array<{ triggerType: string; config: Prisma.InputJsonValue; isEnabled?: boolean }>;
  exitRules: Array<{
    exitReason: string;
    config?: Prisma.InputJsonValue;
    evaluateBeforeMessaging?: boolean;
  }>;
};

function buildGraphFromInput(input: SaveGraphInput): AutomationGraph {
  return {
    nodes: input.nodes.map((node) => ({
      id: node.nodeKey,
      type: node.nodeType,
      label: node.label,
      config: (node.config as Record<string, unknown>) ?? {},
    })),
    edges: input.edges.map((edge, index) => ({
      id: `edge-${index}`,
      sourceNodeId: edge.sourceNodeKey,
      targetNodeId: edge.targetNodeKey,
      label: edge.branchLabel,
    })),
    exitRules: input.exitRules.map((rule) => ({
      type: rule.exitReason,
      config: (rule.config as Record<string, unknown>) ?? {},
    })),
  };
}

function validateGraphInput(input: SaveGraphInput): void {
  const graph = buildGraphFromInput(input);
  const validation = validateAutomationGraph(graph);
  if (!validation.valid) {
    throw new AppError("VALIDATION_ERROR", validation.errors.join(" "));
  }

  const safety = validateGraphSafety(graph);
  if (!safety.safe) {
    throw new AppError("VALIDATION_ERROR", safety.issues.join(" "));
  }

  for (const trigger of input.triggers) {
    const result = validateTriggerConfig({
      triggerType: trigger.triggerType as never,
      ...(trigger.config as Record<string, unknown>),
    });
    if (!result.valid) {
      throw new AppError("VALIDATION_ERROR", result.errors.join(" "));
    }
  }

  for (const node of input.nodes) {
    if (node.nodeType === "ACTION" && node.config) {
      const config = node.config as Record<string, unknown>;
      const actionType = String(config.actionType ?? "");
      if (actionType) {
        const result = validateActionConfig(actionType as never, config);
        if (!result.valid) {
          throw new AppError("VALIDATION_ERROR", result.errors.join(" "));
        }
      }
    }
    if (node.nodeType === "DELAY" && node.delay) {
      const result = validateDelayConfig(node.delay as never);
      if (!result.valid) {
        throw new AppError("VALIDATION_ERROR", result.errors.join(" "));
      }
    }
  }
}

async function getLatestVersionId(automationId: string) {
  const version = await prisma.marketingAutomationVersion.findFirst({
    where: { automationId },
    orderBy: { versionNumber: "desc" },
  });
  return version?.id;
}

async function getAutomationOrThrow(
  automationId: string,
  brandId: string,
  organisationId: string,
  context: TenantContext,
) {
  await brandService.getById(brandId, organisationId, context);
  const automation = await prisma.marketingAutomation.findFirst({
    where: { id: automationId, organisationId, brandId, archivedAt: null },
    include: automationInclude,
  });
  if (!automation) throw new AppError("NOT_FOUND", "Automation not found.");
  return automation;
}

export const marketingAutomationService = {
  async listAutomations(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.marketingAutomation.findMany({
      where: { organisationId, brandId, archivedAt: null },
      include: automationInclude,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  },

  async getAutomation(
    automationId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    return getAutomationOrThrow(automationId, brandId, organisationId, context);
  },

  async createAutomation(
    brandId: string,
    organisationId: string,
    input: {
      name: string;
      description?: string;
      repeatEnrollmentPolicy?: MarketingAutomationRepeatPolicy;
      testMode?: boolean;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    return prisma.$transaction(async (tx) => {
      const automation = await tx.marketingAutomation.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          name: input.name,
          description: input.description,
          repeatEnrollmentPolicy: input.repeatEnrollmentPolicy ?? "ONE_TIME",
          testMode: input.testMode ?? false,
          createdByUserId: context.userProfileId,
        },
      });
      const version = await tx.marketingAutomationVersion.create({
        data: {
          automationId: automation.id,
          versionNumber: 1,
          testMode: input.testMode ?? false,
        },
      });
      return tx.marketingAutomation.update({
        where: { id: automation.id },
        data: { activeVersionId: version.id },
        include: automationInclude,
      });
    });
  },

  async updateAutomation(
    automationId: string,
    brandId: string,
    organisationId: string,
    input: {
      name?: string;
      description?: string;
      repeatEnrollmentPolicy?: MarketingAutomationRepeatPolicy;
      testMode?: boolean;
    },
    context: TenantContext,
  ) {
    await getAutomationOrThrow(automationId, brandId, organisationId, context);
    return prisma.marketingAutomation.update({
      where: { id: automationId },
      data: {
        ...input,
        updatedByUserId: context.userProfileId,
      },
      include: automationInclude,
    });
  },

  async saveGraph(
    automationId: string,
    brandId: string,
    organisationId: string,
    input: SaveGraphInput,
    context: TenantContext,
  ) {
    const automation = await getAutomationOrThrow(automationId, brandId, organisationId, context);
    if (automation.status === "ACTIVE") {
      throw new AppError("VALIDATION_ERROR", "Cannot edit graph while automation is active.");
    }

    validateGraphInput(input);
    const graph = buildGraphFromInput(input);
    const hashes = hashGraphComponents(graph);

    const versionId = automation.versions[0]?.id ?? (await getLatestVersionId(automationId));
    if (!versionId) throw new AppError("VALIDATION_ERROR", "Automation has no version.");

    return prisma.$transaction(async (tx) => {
      await tx.marketingAutomationTrigger.deleteMany({ where: { versionId } });
      await tx.marketingAutomationExitRule.deleteMany({ where: { versionId } });
      await tx.marketingAutomationEdge.deleteMany({ where: { versionId } });
      await tx.marketingAutomationNode.deleteMany({ where: { versionId } });

      const nodeKeyToId = new Map<string, string>();
      for (const node of input.nodes) {
        const created = await tx.marketingAutomationNode.create({
          data: {
            versionId,
            nodeKey: node.nodeKey,
            nodeType: node.nodeType,
            label: node.label,
            positionX: node.positionX ?? 0,
            positionY: node.positionY ?? 0,
            config: node.config,
          },
        });
        nodeKeyToId.set(node.nodeKey, created.id);

        if (node.condition) {
          await tx.marketingAutomationCondition.create({
            data: {
              nodeId: created.id,
              field: node.condition.field as never,
              operator: node.condition.operator,
              value: node.condition.value,
            },
          });
        }

        if (node.delay) {
          await tx.marketingAutomationDelay.create({
            data: {
              nodeId: created.id,
              delayType: node.delay.delayType as never,
              durationMinutes: node.delay.durationMinutes,
              untilAt: node.delay.untilAt ? new Date(node.delay.untilAt) : null,
              timezone: node.delay.timezone,
              businessDaysOnly: node.delay.businessDaysOnly ?? false,
              daypartStart: node.delay.daypartStart,
              daypartEnd: node.delay.daypartEnd,
              waitEventType: node.delay.waitEventType,
              maxWaitMinutes: node.delay.maxWaitMinutes,
              config: node.delay.config,
            },
          });
        }

        if (node.goal) {
          await tx.marketingAutomationGoal.create({
            data: {
              versionId,
              nodeId: created.id,
              goalType: node.goal.goalType,
              config: node.goal.config,
            },
          });
        }
      }

      for (const edge of input.edges) {
        const sourceNodeId = nodeKeyToId.get(edge.sourceNodeKey);
        const targetNodeId = nodeKeyToId.get(edge.targetNodeKey);
        if (!sourceNodeId || !targetNodeId) {
          throw new AppError("VALIDATION_ERROR", "Edge references unknown node key.");
        }
        await tx.marketingAutomationEdge.create({
          data: {
            versionId,
            sourceNodeId,
            targetNodeId,
            branchLabel: edge.branchLabel,
          },
        });
      }

      for (const trigger of input.triggers) {
        await tx.marketingAutomationTrigger.create({
          data: {
            versionId,
            triggerType: trigger.triggerType as never,
            config: trigger.config,
            isEnabled: trigger.isEnabled ?? true,
          },
        });
      }

      for (const rule of input.exitRules) {
        await tx.marketingAutomationExitRule.create({
          data: {
            versionId,
            exitReason: rule.exitReason as never,
            config: rule.config,
            evaluateBeforeMessaging: rule.evaluateBeforeMessaging ?? false,
          },
        });
      }

      const version = await tx.marketingAutomationVersion.update({
        where: { id: versionId },
        data: {
          ...hashes,
          status: "DRAFT",
        },
        include: versionInclude,
      });

      await tx.marketingAutomationApproval.updateMany({
        where: { versionId, status: "APPROVED" },
        data: { status: "SUPERSEDED" },
      });

      await tx.marketingAutomation.update({
        where: { id: automationId },
        data: { status: "DRAFT", updatedByUserId: context.userProfileId },
      });

      return version;
    });
  },

  async submitForReview(
    automationId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    const automation = await getAutomationOrThrow(automationId, brandId, organisationId, context);
    const version = automation.versions[0];
    if (!version) throw new AppError("VALIDATION_ERROR", "No version to submit.");

    if (!version.nodes.length) {
      throw new AppError("VALIDATION_ERROR", "Automation graph is empty.");
    }

    await prisma.$transaction([
      prisma.marketingAutomation.update({
        where: { id: automationId },
        data: { status: "IN_REVIEW", updatedByUserId: context.userProfileId },
      }),
      prisma.marketingAutomationVersion.update({
        where: { id: version.id },
        data: { status: "IN_REVIEW" },
      }),
      prisma.marketingAutomationApproval.create({
        data: { versionId: version.id, status: "PENDING", ...hashGraphComponents(buildVersionGraph(version)) },
      }),
    ]);

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "automation.submitForReview",
      resourceType: "MarketingAutomation",
      resourceId: automationId,
      metadata: { brandId, versionId: version.id },
    });

    return getAutomationOrThrow(automationId, brandId, organisationId, context);
  },

  async approveVersion(
    automationId: string,
    brandId: string,
    organisationId: string,
    input: { versionId?: string; notes?: string },
    context: TenantContext,
  ) {
    const automation = await getAutomationOrThrow(automationId, brandId, organisationId, context);
    const versionId = input.versionId ?? automation.versions[0]?.id;
    if (!versionId) throw new AppError("VALIDATION_ERROR", "No version to approve.");

    const version = await prisma.marketingAutomationVersion.findFirst({
      where: { id: versionId, automationId },
      include: versionInclude,
    });
    if (!version) throw new AppError("NOT_FOUND", "Version not found.");

    const hashes = hashGraphComponents(buildVersionGraph(version));

    await prisma.$transaction([
      prisma.marketingAutomationApproval.updateMany({
        where: { versionId, status: "PENDING" },
        data: { status: "SUPERSEDED" },
      }),
      prisma.marketingAutomationApproval.create({
        data: {
          versionId,
          status: "APPROVED",
          approverUserId: context.userProfileId,
          notes: input.notes,
          ...hashes,
        },
      }),
      prisma.marketingAutomationVersion.update({
        where: { id: versionId },
        data: { status: "APPROVED", ...hashes },
      }),
      prisma.marketingAutomation.update({
        where: { id: automationId },
        data: { status: "APPROVED", updatedByUserId: context.userProfileId },
      }),
    ]);

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "automation.approve",
      resourceType: "MarketingAutomation",
      resourceId: automationId,
      metadata: { brandId, versionId },
    });

    return getAutomationOrThrow(automationId, brandId, organisationId, context);
  },

  async activateVersion(
    automationId: string,
    brandId: string,
    organisationId: string,
    input: { versionId?: string },
    context: TenantContext,
  ) {
    const automation = await getAutomationOrThrow(automationId, brandId, organisationId, context);
    if (automation.globalStopped) {
      throw new AppError("VALIDATION_ERROR", "Automation is globally stopped.");
    }

    const versionId = input.versionId ?? automation.versions[0]?.id;
    if (!versionId) throw new AppError("VALIDATION_ERROR", "No version to activate.");

    const version = await prisma.marketingAutomationVersion.findFirst({
      where: { id: versionId, automationId },
      include: {
        approvals: { orderBy: { createdAt: "desc" } },
        nodes: true,
        edges: { include: { sourceNode: true, targetNode: true } },
        exitRules: true,
      },
    });
    if (!version) throw new AppError("NOT_FOUND", "Version not found.");

    const hashes = hashGraphComponents(buildVersionGraph(version));
    const approvalCheck = evaluateRequiredApprovals(version.approvals, hashes);
    if (!approvalCheck.complete) {
      throw new AppError("VALIDATION_ERROR", `Approval required: ${approvalCheck.pending.join(", ") || approvalCheck.stale.join(", ")}`);
    }

    const latestApproval = version.approvals.find((a) => a.status === "APPROVED");
    if (latestApproval) {
      const validity = isApprovalValid(latestApproval, hashes);
      if (!validity.valid) {
        throw new AppError("VALIDATION_ERROR", validity.reason ?? "Stale approval.");
      }
    }

    await prisma.$transaction([
      prisma.marketingAutomation.update({
        where: { id: automationId },
        data: {
          status: "ACTIVE",
          activeVersionId: versionId,
          updatedByUserId: context.userProfileId,
        },
      }),
      prisma.marketingAutomationVersion.update({
        where: { id: versionId },
        data: { status: "ACTIVE" },
      }),
    ]);

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "automation.activate",
      resourceType: "MarketingAutomation",
      resourceId: automationId,
      metadata: { brandId, versionId },
    });

    return getAutomationOrThrow(automationId, brandId, organisationId, context);
  },

  async pauseAutomation(
    automationId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    await getAutomationOrThrow(automationId, brandId, organisationId, context);
    const automation = await prisma.marketingAutomation.update({
      where: { id: automationId },
      data: { status: "PAUSED", updatedByUserId: context.userProfileId },
      include: automationInclude,
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "automation.pause",
      resourceType: "MarketingAutomation",
      resourceId: automationId,
      metadata: { brandId },
    });

    return automation;
  },

  async stopAutomation(
    automationId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    await getAutomationOrThrow(automationId, brandId, organisationId, context);
    const automation = await prisma.marketingAutomation.update({
      where: { id: automationId },
      data: { status: "STOPPED", updatedByUserId: context.userProfileId },
      include: automationInclude,
    });

    await prisma.marketingAutomationEnrollment.updateMany({
      where: { automationId, status: "ACTIVE" },
      data: { status: "EXITED", exitedAt: new Date(), exitReason: "AUTOMATION_STOPPED" },
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "automation.stop",
      resourceType: "MarketingAutomation",
      resourceId: automationId,
      metadata: { brandId },
    });

    return automation;
  },

  async globalStop(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const result = await prisma.marketingAutomation.updateMany({
      where: { organisationId, brandId, status: "ACTIVE", globalStopped: false },
      data: { globalStopped: true, status: "STOPPED", updatedByUserId: context.userProfileId },
    });

    await prisma.marketingAutomationEnrollment.updateMany({
      where: {
        automation: { organisationId, brandId },
        status: "ACTIVE",
      },
      data: { status: "EXITED", exitedAt: new Date(), exitReason: "AUTOMATION_STOPPED" },
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "automation.globalStop",
      resourceType: "Brand",
      resourceId: brandId,
      metadata: { stoppedCount: result.count },
    });

    return { stoppedCount: result.count };
  },

  async createFromTemplate(
    brandId: string,
    organisationId: string,
    templateKey: string,
    context: TenantContext,
  ) {
    const template = Object.values(JOURNEY_TEMPLATES).find((t) => t.templateKey === templateKey);
    if (!template) throw new AppError("NOT_FOUND", `Template not found: ${templateKey}`);

    const automation = await this.createAutomation(
      brandId,
      organisationId,
      {
        name: template.name,
        description: template.description,
        repeatEnrollmentPolicy: template.repeatPolicy,
      },
      context,
    );

    const triggers = template.graph.nodes
      .filter((n) => n.type === "TRIGGER")
      .map((n) => ({
        triggerType: String((n.config as Record<string, unknown>)?.triggerType ?? "MANUAL_ENROLLMENT"),
        config: (n.config ?? {}) as Prisma.InputJsonValue,
        isEnabled: true,
      }));

    const nodes: SaveGraphNodeInput[] = template.graph.nodes.map((n) => ({
      nodeKey: n.id,
      nodeType: n.type as MarketingAutomationNodeType,
      label: n.label,
      config: (n.config ?? {}) as Prisma.InputJsonValue,
      ...(n.type === "DELAY"
        ? {
            delay: {
              delayType: String((n.config as Record<string, unknown>)?.delayType ?? "FIXED_DURATION"),
              durationMinutes: (n.config as Record<string, unknown>)?.durationMinutes as number | undefined,
              timezone: (n.config as Record<string, unknown>)?.timezone as string | undefined,
              daypartStart: (n.config as Record<string, unknown>)?.daypartStart as string | undefined,
              daypartEnd: (n.config as Record<string, unknown>)?.daypartEnd as string | undefined,
              waitEventType: (n.config as Record<string, unknown>)?.waitEventType as string | undefined,
              maxWaitMinutes: (n.config as Record<string, unknown>)?.maxWaitMinutes as number | undefined,
            },
          }
        : {}),
    }));

    const edges = template.graph.edges.map((e) => ({
      sourceNodeKey: e.sourceNodeId,
      targetNodeKey: e.targetNodeId,
      branchLabel: e.label,
    }));

    const exitRules = (template.graph.exitRules ?? []).map((r) => ({
      exitReason: r.type,
      evaluateBeforeMessaging: true,
      config: (r.config ?? {}) as Prisma.InputJsonValue,
    }));

    await this.saveGraph(
      automation.id,
      brandId,
      organisationId,
      { nodes, edges, triggers, exitRules },
      context,
    );

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "automation.createFromTemplate",
      resourceType: "MarketingAutomation",
      resourceId: automation.id,
      metadata: { brandId, templateKey },
    });

    return getAutomationOrThrow(automation.id, brandId, organisationId, context);
  },

  listTemplates() {
    return listJourneyTemplates();
  },

  async getAnalytics(
    automationId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    await getAutomationOrThrow(automationId, brandId, organisationId, context);

    const enrollments = await prisma.marketingAutomationEnrollment.groupBy({
      by: ["status"],
      where: { automationId },
      _count: { _all: true },
    });

    const enrollmentMetric = {
      enrolled: 0,
      active: 0,
      completed: 0,
      exited: 0,
      blocked: 0,
    };
    for (const row of enrollments) {
      const count = row._count._all;
      enrollmentMetric.enrolled += count;
      if (row.status === "ACTIVE" || row.status === "PAUSED") enrollmentMetric.active += count;
      if (row.status === "COMPLETED") enrollmentMetric.completed += count;
      if (row.status === "EXITED" || row.status === "FAILED") enrollmentMetric.exited += count;
    }

    const actionRuns = await prisma.marketingAutomationActionRun.findMany({
      where: { enrollment: { automationId } },
      select: { actionType: true, status: true },
    });

    const actionMap = new Map<string, { attempted: number; succeeded: number; failed: number; skipped: number }>();
    for (const run of actionRuns) {
      const key = run.actionType;
      const entry = actionMap.get(key) ?? { attempted: 0, succeeded: 0, failed: 0, skipped: 0 };
      entry.attempted += 1;
      if (run.status === "SUCCEEDED") entry.succeeded += 1;
      else if (run.status === "FAILED") entry.failed += 1;
      else if (run.status === "SKIPPED") entry.skipped += 1;
      actionMap.set(key, entry);
    }

    const emailRuns = actionRuns.filter((r) => r.actionType === "SEND_EMAIL" && r.status === "SUCCEEDED");

    return computeAutomationAnalytics({
      enrollments: enrollmentMetric,
      actions: [...actionMap.entries()].map(([actionType, metrics]) => ({ actionType, ...metrics })),
      emailsSent: emailRuns.length,
    });
  },

  async listErrors(
    automationId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
    filters?: { resolved?: boolean },
  ) {
    await getAutomationOrThrow(automationId, brandId, organisationId, context);
    return prisma.marketingAutomationError.findMany({
      where: {
        automationId,
        ...(filters?.resolved === true ? { resolvedAt: { not: null } } : {}),
        ...(filters?.resolved === false ? { resolvedAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  async resolveError(
    errorId: string,
    automationId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    await getAutomationOrThrow(automationId, brandId, organisationId, context);
    const error = await prisma.marketingAutomationError.findFirst({
      where: { id: errorId, automationId },
    });
    if (!error) throw new AppError("NOT_FOUND", "Error not found.");
    return prisma.marketingAutomationError.update({
      where: { id: errorId },
      data: { resolvedAt: new Date() },
    });
  },
};

function buildVersionGraph(
  version: {
    nodes: Array<{
      nodeKey: string;
      nodeType: MarketingAutomationNodeType;
      label: string | null;
      config: Prisma.JsonValue;
    }>;
    edges: Array<{
      sourceNode: { nodeKey: string };
      targetNode: { nodeKey: string };
      branchLabel: string | null;
    }>;
    exitRules: Array<{ exitReason: string; config: Prisma.JsonValue | null }>;
  },
): AutomationGraph {
  return {
    nodes: version.nodes.map((node) => ({
      id: node.nodeKey,
      type: node.nodeType,
      label: node.label ?? undefined,
      config: (node.config as Record<string, unknown>) ?? {},
    })),
    edges: version.edges.map((edge, index) => ({
      id: `edge-${index}`,
      sourceNodeId: edge.sourceNode.nodeKey,
      targetNodeId: edge.targetNode.nodeKey,
      label: edge.branchLabel ?? undefined,
    })),
    exitRules: version.exitRules.map((rule) => ({
      type: rule.exitReason,
      config: (rule.config as Record<string, unknown>) ?? {},
    })),
  };
}
