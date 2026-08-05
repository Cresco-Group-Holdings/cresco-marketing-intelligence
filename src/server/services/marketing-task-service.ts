import {
  MarketingTaskActivityType,
  MarketingTaskStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  computeBlockedStatus,
  isTaskOverdue,
  wouldCreateDependencyCycle,
} from "@/lib/tasks/dependencies";
import { DEFAULT_CHECKLIST_ITEMS } from "@/lib/tasks/constants";
import type { TenantContext } from "@/lib/tenancy/context";
import type {
  MarketingTaskCreateInput,
  MarketingTaskUpdateInput,
} from "@/lib/validation/marketing-tasks";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";

type BrandScope = {
  organisationId: string;
  projectId: string;
  brandId: string;
};

const TASK_INCLUDE = {
  assignee: { select: { id: true, displayName: true, email: true } },
  reporter: { select: { id: true, displayName: true, email: true } },
  campaign: { select: { id: true, name: true } },
  dependencies: {
    include: {
      dependsOnTask: { select: { id: true, title: true, status: true } },
    },
  },
  checklistItems: { orderBy: { sortOrder: "asc" as const } },
  comments: { orderBy: { createdAt: "desc" as const }, take: 20 },
  attachments: { orderBy: { createdAt: "desc" as const } },
  watchers: {
    include: { user: { select: { id: true, displayName: true, email: true } } },
  },
  activities: { orderBy: { createdAt: "desc" as const }, take: 30 },
} satisfies Prisma.MarketingTaskInclude;

async function resolveBrandScope(
  brandId: string,
  organisationId: string,
  context: TenantContext,
): Promise<BrandScope> {
  const brand = await brandService.getById(brandId, organisationId, context);
  return { organisationId, projectId: brand.projectId, brandId };
}

async function assertActiveMember(organisationId: string, userId: string) {
  const membership = await prisma.organisationMembership.findFirst({
    where: { organisationId, userId, status: "ACTIVE" },
  });
  if (!membership) {
    throw new AppError("VALIDATION_ERROR", "User must be an active organisation member.");
  }
}

async function getTaskOrThrow(scope: BrandScope, taskId: string) {
  const task = await prisma.marketingTask.findFirst({
    where: {
      id: taskId,
      organisationId: scope.organisationId,
      brandId: scope.brandId,
      archivedAt: null,
      isTemplate: false,
    },
    include: TASK_INCLUDE,
  });
  if (!task) {
    throw new AppError("NOT_FOUND", "Task was not found.");
  }
  return task;
}

async function recordTaskActivity(input: {
  organisationId: string;
  taskId: string;
  activityType: MarketingTaskActivityType;
  actorUserId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.marketingTaskActivity.create({
    data: {
      organisationId: input.organisationId,
      taskId: input.taskId,
      activityType: input.activityType,
      actorUserId: input.actorUserId,
      summary: input.summary,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

function serializeTask(
  task: Awaited<ReturnType<typeof getTaskOrThrow>>,
  now = new Date(),
) {
  const effectiveStatus = computeBlockedStatus(
    { id: task.id, status: task.status },
    task.dependencies,
  );

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    type: task.type,
    status: effectiveStatus,
    rawStatus: task.status,
    priority: task.priority,
    version: task.version,
    assigneeUserId: task.assigneeUserId,
    reporterUserId: task.reporterUserId,
    assignee: task.assignee,
    reporter: task.reporter,
    campaignId: task.campaignId,
    campaign: task.campaign,
    sourceEntityType: task.sourceEntityType,
    sourceEntityId: task.sourceEntityId,
    startAt: task.startAt?.toISOString() ?? null,
    dueAt: task.dueAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    isOverdue: isTaskOverdue(task.dueAt, effectiveStatus, now),
    isBlocked: effectiveStatus === "BLOCKED",
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    dependencies: task.dependencies.map((d) => ({
      id: d.id,
      dependsOnTaskId: d.dependsOnTaskId,
      dependsOnTask: d.dependsOnTask,
    })),
    checklistItems: task.checklistItems,
    comments: task.comments,
    attachments: task.attachments,
    watchers: task.watchers,
    activities: task.activities,
  };
}

async function refreshBlockedStatus(scope: BrandScope, taskId: string) {
  const task = await getTaskOrThrow(scope, taskId);
  const effectiveStatus = computeBlockedStatus(
    { id: task.id, status: task.status },
    task.dependencies,
  );

  if (effectiveStatus !== task.status) {
    await prisma.marketingTask.update({
      where: { id: taskId },
      data: { status: effectiveStatus },
    });
  }
}

export const marketingTaskService = {
  async list(
    brandId: string,
    organisationId: string,
    context: TenantContext,
    filters?: {
      status?: MarketingTaskStatus;
      type?: import("@prisma/client").MarketingTaskType;
      priority?: import("@prisma/client").MarketingTaskPriority;
      assigneeUserId?: string;
      campaignId?: string;
      sourceEntityType?: string;
      sourceEntityId?: string;
      overdueOnly?: boolean;
      blockedOnly?: boolean;
      myTasks?: boolean;
      search?: string;
    },
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const now = new Date();

    const tasks = await prisma.marketingTask.findMany({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        archivedAt: null,
        isTemplate: false,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.type ? { type: filters.type } : {}),
        ...(filters?.priority ? { priority: filters.priority } : {}),
        ...(filters?.assigneeUserId ? { assigneeUserId: filters.assigneeUserId } : {}),
        ...(filters?.campaignId ? { campaignId: filters.campaignId } : {}),
        ...(filters?.sourceEntityType ? { sourceEntityType: filters.sourceEntityType } : {}),
        ...(filters?.sourceEntityId ? { sourceEntityId: filters.sourceEntityId } : {}),
        ...(filters?.myTasks
          ? {
              OR: [
                { assigneeUserId: context.userProfileId },
                { reporterUserId: context.userProfileId },
              ],
            }
          : {}),
        ...(filters?.search
          ? {
              OR: [
                { title: { contains: filters.search, mode: "insensitive" } },
                { description: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: TASK_INCLUDE,
      orderBy: [{ dueAt: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    });

    let results = tasks.map((t) => serializeTask(t, now));

    if (filters?.overdueOnly) {
      results = results.filter((t) => t.isOverdue);
    }
    if (filters?.blockedOnly) {
      results = results.filter((t) => t.isBlocked);
    }

    return results;
  },

  async getById(brandId: string, organisationId: string, taskId: string, context: TenantContext) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const task = await getTaskOrThrow(scope, taskId);
    return serializeTask(task);
  },

  async create(
    brandId: string,
    organisationId: string,
    input: MarketingTaskCreateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);

    if (input.assigneeUserId) {
      await assertActiveMember(scope.organisationId, input.assigneeUserId);
    }

    let templateData: Partial<MarketingTaskCreateInput> = {};
    if (input.templateId) {
      const template = await prisma.marketingTask.findFirst({
        where: {
          id: input.templateId,
          organisationId: scope.organisationId,
          brandId: scope.brandId,
          isTemplate: true,
          archivedAt: null,
        },
      });
      if (!template) {
        throw new AppError("NOT_FOUND", "Task template was not found.");
      }
      templateData = {
        title: template.title,
        description: template.description ?? undefined,
        type: template.type,
        priority: template.priority,
      };
    }

    const merged = { ...templateData, ...input };

    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.marketingTask.create({
        data: {
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          campaignId: merged.campaignId ?? null,
          title: merged.title,
          description: merged.description || null,
          type: merged.type ?? "GENERAL",
          status: merged.status ?? "TODO",
          priority: merged.priority ?? "MEDIUM",
          assigneeUserId: merged.assigneeUserId ?? null,
          reporterUserId: context.userProfileId,
          startAt: merged.startAt ? new Date(merged.startAt) : null,
          dueAt: merged.dueAt ? new Date(merged.dueAt) : null,
          sourceEntityType: merged.sourceEntityType ?? null,
          sourceEntityId: merged.sourceEntityId ?? null,
          templateId: input.templateId ?? null,
        },
      });

      const checklistLabels = merged.checklistItems ?? DEFAULT_CHECKLIST_ITEMS;
      if (checklistLabels.length > 0) {
        await tx.marketingTaskChecklistItem.createMany({
          data: checklistLabels.map((label, index) => ({
            organisationId: scope.organisationId,
            taskId: created.id,
            label,
            sortOrder: index,
          })),
        });
      }

      if (merged.watcherUserIds?.length) {
        await tx.marketingTaskWatcher.createMany({
          data: merged.watcherUserIds.map((userId) => ({
            organisationId: scope.organisationId,
            taskId: created.id,
            userId,
          })),
        });
      }

      return created;
    });

    await recordTaskActivity({
      organisationId: scope.organisationId,
      taskId: task.id,
      activityType: "CREATED",
      actorUserId: context.userProfileId,
      summary: `Task "${task.title}" created`,
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "marketingTask.created",
      resourceType: "marketingTask",
      resourceId: task.id,
      requestId,
    });

    return this.getById(brandId, organisationId, task.id, context);
  },

  async update(
    brandId: string,
    organisationId: string,
    taskId: string,
    input: MarketingTaskUpdateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const existing = await getTaskOrThrow(scope, taskId);

    if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
      throw new AppError(
        "CONFLICT",
        `Version conflict: expected ${input.expectedVersion}, current is ${existing.version}.`,
      );
    }

    if (input.assigneeUserId) {
      await assertActiveMember(scope.organisationId, input.assigneeUserId);
    }

    const nextVersion = existing.version + 1;
    const data: Prisma.MarketingTaskUpdateInput = { version: nextVersion };

    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description || null;
    if (input.type !== undefined) data.type = input.type;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.assigneeUserId !== undefined) {
      data.assignee = input.assigneeUserId
        ? { connect: { id: input.assigneeUserId } }
        : { disconnect: true };
    }
    if (input.campaignId !== undefined) {
      data.campaign = input.campaignId
        ? { connect: { id: input.campaignId } }
        : { disconnect: true };
    }
    if (input.startAt !== undefined) data.startAt = input.startAt ? new Date(input.startAt) : null;
    if (input.dueAt !== undefined) data.dueAt = input.dueAt ? new Date(input.dueAt) : null;
    if (input.sourceEntityType !== undefined) data.sourceEntityType = input.sourceEntityType || null;
    if (input.sourceEntityId !== undefined) data.sourceEntityId = input.sourceEntityId || null;

    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === "DONE") {
        data.completedAt = new Date();
      }
    }

    await prisma.marketingTask.update({ where: { id: taskId }, data });

    if (input.status && input.status !== existing.status) {
      await recordTaskActivity({
        organisationId: scope.organisationId,
        taskId,
        activityType: "STATUS_CHANGED",
        actorUserId: context.userProfileId,
        summary: `Status changed from ${existing.status} to ${input.status}`,
        metadata: { from: existing.status, to: input.status },
      });

      // Refresh blocked status for dependent tasks
      const dependents = await prisma.marketingTaskDependency.findMany({
        where: { dependsOnTaskId: taskId },
        select: { taskId: true },
      });
      for (const dep of dependents) {
        await refreshBlockedStatus(scope, dep.taskId);
      }
    } else {
      await recordTaskActivity({
        organisationId: scope.organisationId,
        taskId,
        activityType: "UPDATED",
        actorUserId: context.userProfileId,
        summary: `Task "${existing.title}" updated`,
      });
    }

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "marketingTask.updated",
      resourceType: "marketingTask",
      resourceId: taskId,
      requestId,
    });

    return this.getById(brandId, organisationId, taskId, context);
  },

  async addDependency(
    brandId: string,
    organisationId: string,
    taskId: string,
    dependsOnTaskId: string,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    await getTaskOrThrow(scope, taskId);
    await getTaskOrThrow(scope, dependsOnTaskId);

    const existingEdges = await prisma.marketingTaskDependency.findMany({
      where: { organisationId: scope.organisationId },
      select: { taskId: true, dependsOnTaskId: true },
    });

    if (
      wouldCreateDependencyCycle(taskId, dependsOnTaskId, existingEdges)
    ) {
      throw new AppError("VALIDATION_ERROR", "Adding this dependency would create a cycle.");
    }

    await prisma.marketingTaskDependency.create({
      data: {
        organisationId: scope.organisationId,
        taskId,
        dependsOnTaskId,
      },
    });

    await refreshBlockedStatus(scope, taskId);
    await recordTaskActivity({
      organisationId: scope.organisationId,
      taskId,
      activityType: "DEPENDENCY_ADDED",
      actorUserId: context.userProfileId,
      summary: `Dependency added on task ${dependsOnTaskId}`,
    });

    return this.getById(brandId, organisationId, taskId, context);
  },

  async removeDependency(
    brandId: string,
    organisationId: string,
    taskId: string,
    dependencyId: string,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const dep = await prisma.marketingTaskDependency.findFirst({
      where: { id: dependencyId, taskId, organisationId: scope.organisationId },
    });
    if (!dep) {
      throw new AppError("NOT_FOUND", "Dependency was not found.");
    }

    await prisma.marketingTaskDependency.delete({ where: { id: dependencyId } });
    await refreshBlockedStatus(scope, taskId);
    await recordTaskActivity({
      organisationId: scope.organisationId,
      taskId,
      activityType: "DEPENDENCY_REMOVED",
      actorUserId: context.userProfileId,
      summary: "Dependency removed",
    });

    return this.getById(brandId, organisationId, taskId, context);
  },

  async addComment(
    brandId: string,
    organisationId: string,
    taskId: string,
    body: string,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    await getTaskOrThrow(scope, taskId);

    const comment = await prisma.marketingTaskComment.create({
      data: {
        organisationId: scope.organisationId,
        taskId,
        authorUserId: context.userProfileId,
        body,
      },
    });

    await recordTaskActivity({
      organisationId: scope.organisationId,
      taskId,
      activityType: "COMMENT_ADDED",
      actorUserId: context.userProfileId,
      summary: "Comment added",
    });

    return comment;
  },

  async addAttachment(
    brandId: string,
    organisationId: string,
    taskId: string,
    input: { fileName: string; fileUrl: string; mimeType?: string; fileSizeBytes?: number },
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    await getTaskOrThrow(scope, taskId);

    const attachment = await prisma.marketingTaskAttachment.create({
      data: {
        organisationId: scope.organisationId,
        taskId,
        uploadedByUserId: context.userProfileId,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        mimeType: input.mimeType ?? null,
        fileSizeBytes: input.fileSizeBytes ?? null,
      },
    });

    await recordTaskActivity({
      organisationId: scope.organisationId,
      taskId,
      activityType: "ATTACHMENT_ADDED",
      actorUserId: context.userProfileId,
      summary: `Attachment "${input.fileName}" added`,
    });

    return attachment;
  },

  async updateChecklistItem(
    brandId: string,
    organisationId: string,
    taskId: string,
    itemId: string,
    isCompleted: boolean,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    await getTaskOrThrow(scope, taskId);

    const item = await prisma.marketingTaskChecklistItem.findFirst({
      where: { id: itemId, taskId, organisationId: scope.organisationId },
    });
    if (!item) {
      throw new AppError("NOT_FOUND", "Checklist item was not found.");
    }

    await prisma.marketingTaskChecklistItem.update({
      where: { id: itemId },
      data: {
        isCompleted,
        completedByUserId: isCompleted ? context.userProfileId : null,
        completedAt: isCompleted ? new Date() : null,
      },
    });

    await recordTaskActivity({
      organisationId: scope.organisationId,
      taskId,
      activityType: "CHECKLIST_UPDATED",
      actorUserId: context.userProfileId,
      summary: `Checklist item "${item.label}" ${isCompleted ? "completed" : "reopened"}`,
    });

    return this.getById(brandId, organisationId, taskId, context);
  },

  async complete(
    brandId: string,
    organisationId: string,
    taskId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    return this.update(
      brandId,
      organisationId,
      taskId,
      { status: "DONE" },
      context,
      requestId,
    );
  },

  async archive(
    brandId: string,
    organisationId: string,
    taskId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    await getTaskOrThrow(scope, taskId);

    await prisma.marketingTask.update({
      where: { id: taskId },
      data: { archivedAt: new Date(), status: "CANCELLED" },
    });

    await recordTaskActivity({
      organisationId: scope.organisationId,
      taskId,
      activityType: "ARCHIVED",
      actorUserId: context.userProfileId,
      summary: "Task archived",
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "marketingTask.archived",
      resourceType: "marketingTask",
      resourceId: taskId,
      requestId,
    });

    return { id: taskId, archived: true };
  },

  async listTemplates(brandId: string, organisationId: string, context: TenantContext) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    return prisma.marketingTask.findMany({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        isTemplate: true,
        archivedAt: null,
      },
      orderBy: { title: "asc" },
    });
  },

  async listByEntity(
    brandId: string,
    organisationId: string,
    entityType: string,
    entityId: string,
    context: TenantContext,
  ) {
    return this.list(brandId, organisationId, context, {
      sourceEntityType: entityType,
      sourceEntityId: entityId,
    });
  },
};
