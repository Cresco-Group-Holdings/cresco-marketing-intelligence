import type { CrmTaskStatus, CrmTaskTypeCode, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { DEFAULT_TASK_TYPE_LABELS } from "@/lib/crm-tasks/constants";
import {
  canAssignTask,
  canCompleteTask,
  isTaskOverdue,
  resolveDisplayStatus,
  validateTaskTransition,
} from "@/lib/crm-tasks/lifecycle";
import { buildTaskReminders } from "@/lib/crm-tasks/reminders";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";
import { recordAuditEvent } from "@/server/services/audit-service";

const taskInclude = {
  owner: { select: { id: true, displayName: true } },
  createdBy: { select: { id: true, displayName: true } },
  lead: { select: { id: true, status: true } },
  opportunity: { select: { id: true, name: true, status: true } },
  company: { select: { id: true, tradingName: true } },
  reminders: { orderBy: { remindAt: "asc" as const } },
  completion: true,
  assignments: {
    orderBy: { assignedAt: "desc" as const },
    include: { assignee: { select: { id: true, displayName: true } } },
  },
} satisfies Prisma.CrmTaskInclude;

async function ensureTaskTypes(organisationId: string) {
  const existing = await prisma.crmTaskType.count({ where: { organisationId } });
  if (existing > 0) return;
  await prisma.crmTaskType.createMany({
    data: Object.entries(DEFAULT_TASK_TYPE_LABELS).map(([code, label], index) => ({
      organisationId,
      code: code as CrmTaskTypeCode,
      label,
      sortOrder: index,
    })),
    skipDuplicates: true,
  });
}

function enrichTask<T extends { status: CrmTaskStatus; dueDate: Date | null; deferredUntil: Date | null }>(task: T) {
  return { ...task, displayStatus: resolveDisplayStatus(task) };
}

export const crmTaskService = {
  async listTasks(
    brandId: string,
    organisationId: string,
    context: TenantContext,
    filters?: {
      status?: string;
      ownerUserId?: string;
      opportunityId?: string;
      leadId?: string;
      overdueOnly?: boolean;
    },
  ) {
    await brandService.getById(brandId, organisationId, context);
    const tasks = await prisma.crmTask.findMany({
      where: {
        organisationId,
        brandId,
        archivedAt: null,
        ...(filters?.status ? { status: filters.status as CrmTaskStatus } : {}),
        ...(filters?.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
        ...(filters?.opportunityId ? { opportunityId: filters.opportunityId } : {}),
        ...(filters?.leadId ? { leadId: filters.leadId } : {}),
      },
      include: taskInclude,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
    const enriched = tasks.map(enrichTask);
    if (filters?.overdueOnly) return enriched.filter((t) => isTaskOverdue(t));
    return enriched;
  },

  async getTask(taskId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const task = await prisma.crmTask.findFirst({
      where: { id: taskId, organisationId, brandId },
      include: taskInclude,
    });
    if (!task) throw new AppError("NOT_FOUND", "Task not found.");
    return enrichTask(task);
  },

  async createTask(
    brandId: string,
    organisationId: string,
    input: {
      title: string;
      description?: string;
      taskTypeCode?: CrmTaskTypeCode;
      ownerUserId?: string;
      dueDate?: string;
      dueTime?: string;
      timezone?: string;
      priority?: number;
      leadId?: string;
      contactId?: string;
      companyId?: string;
      opportunityId?: string;
      formSubmissionId?: string;
      campaignId?: string;
      relatedEntityType?: string;
      relatedEntityId?: string;
      reminderMinutesBefore?: number;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    await ensureTaskTypes(organisationId);

    const dueDate = input.dueDate ? new Date(input.dueDate) : null;
    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.crmTask.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          title: input.title,
          description: input.description,
          taskTypeCode: input.taskTypeCode ?? "OTHER",
          ownerUserId: input.ownerUserId ?? context.userProfileId,
          createdByUserId: context.userProfileId,
          dueDate,
          dueTime: input.dueTime,
          timezone: input.timezone,
          priority: input.priority ?? 0,
          leadId: input.leadId,
          contactId: input.contactId,
          companyId: input.companyId,
          opportunityId: input.opportunityId,
          formSubmissionId: input.formSubmissionId,
          campaignId: input.campaignId,
          relatedEntityType: input.relatedEntityType,
          relatedEntityId: input.relatedEntityId,
        },
        include: taskInclude,
      });

      if (dueDate) {
        const reminders = buildTaskReminders({
          dueDate,
          dueTime: input.dueTime,
          timezone: input.timezone,
          minutesBefore: input.reminderMinutesBefore,
        });
        if (reminders.length > 0) {
          await tx.crmTaskReminder.createMany({
            data: reminders.map((r) => ({
              taskId: created.id,
              remindAt: r.remindAt,
              reminderType: r.reminderType,
              minutesBefore: r.minutesBefore,
              timezone: r.timezone,
            })),
          });
        }
      }

      if (input.opportunityId && input.title) {
        await tx.crmOpportunity.updateMany({
          where: { id: input.opportunityId, organisationId, brandId },
          data: { nextAction: input.title, lastActivityAt: new Date() },
        });
      }

      return created;
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "crm.task.create",
      resourceType: "CrmTask",
      resourceId: task.id,
      metadata: { brandId, title: input.title },
    });

    return enrichTask(task);
  },

  async updateTask(
    taskId: string,
    brandId: string,
    organisationId: string,
    input: {
      title?: string;
      description?: string;
      taskTypeCode?: CrmTaskTypeCode;
      dueDate?: string | null;
      dueTime?: string | null;
      timezone?: string | null;
      priority?: number;
      status?: CrmTaskStatus;
      deferredUntil?: string | null;
    },
    context: TenantContext,
  ) {
    const existing = await this.getTask(taskId, brandId, organisationId, context);
    if (input.status) {
      const check = validateTaskTransition(existing, input.status);
      if (!check.valid) throw new AppError("VALIDATION_ERROR", check.errors[0] ?? "Invalid transition.");
    }

    const task = await prisma.crmTask.update({
      where: { id: taskId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.taskTypeCode ? { taskTypeCode: input.taskTypeCode } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? new Date(input.dueDate) : null } : {}),
        ...(input.dueTime !== undefined ? { dueTime: input.dueTime } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.deferredUntil !== undefined
          ? { deferredUntil: input.deferredUntil ? new Date(input.deferredUntil) : null }
          : {}),
      },
      include: taskInclude,
    });

    return enrichTask(task);
  },

  async assignTask(
    taskId: string,
    brandId: string,
    organisationId: string,
    input: { assigneeId: string; reason?: string },
    context: TenantContext,
  ) {
    const existing = await this.getTask(taskId, brandId, organisationId, context);
    const role = context.organisationRole ?? "VIEWER";
    if (!canAssignTask(existing, context.userProfileId, role)) {
      throw new AppError("FORBIDDEN", "You cannot assign this task.");
    }

    const task = await prisma.$transaction(async (tx) => {
      await tx.crmTaskAssignment.create({
        data: {
          taskId,
          assigneeId: input.assigneeId,
          assignedById: context.userProfileId,
          reason: input.reason,
        },
      });
      return tx.crmTask.update({
        where: { id: taskId },
        data: { ownerUserId: input.assigneeId, status: existing.status === "OPEN" ? "IN_PROGRESS" : existing.status },
        include: taskInclude,
      });
    });

    return enrichTask(task);
  },

  async completeTask(
    taskId: string,
    brandId: string,
    organisationId: string,
    input: { outcome?: string; notes?: string; nextAction?: string },
    context: TenantContext,
  ) {
    const existing = await this.getTask(taskId, brandId, organisationId, context);
    if (!canCompleteTask(existing)) throw new AppError("VALIDATION_ERROR", "Task cannot be completed.");

    const task = await prisma.$transaction(async (tx) => {
      await tx.crmTaskCompletion.upsert({
        where: { taskId },
        create: {
          taskId,
          completedById: context.userProfileId,
          outcome: input.outcome,
          notes: input.notes,
          nextAction: input.nextAction,
        },
        update: {
          completedById: context.userProfileId,
          outcome: input.outcome,
          notes: input.notes,
          nextAction: input.nextAction,
          completedAt: new Date(),
        },
      });
      return tx.crmTask.update({
        where: { id: taskId },
        data: { status: "COMPLETED", completedAt: new Date() },
        include: taskInclude,
      });
    });

    return enrichTask(task);
  },

  async syncOverdueTasks(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const openTasks = await prisma.crmTask.findMany({
      where: {
        organisationId,
        brandId,
        archivedAt: null,
        status: { in: ["OPEN", "IN_PROGRESS", "DEFERRED"] },
        dueDate: { not: null },
      },
    });
    const overdueIds = openTasks.filter((t) => isTaskOverdue(t)).map((t) => t.id);
    if (overdueIds.length === 0) return { updated: 0 };
    await prisma.crmTask.updateMany({
      where: { id: { in: overdueIds } },
      data: { status: "OVERDUE" },
    });
    return { updated: overdueIds.length };
  },

  async listTaskTypes(organisationId: string, context: TenantContext) {
    await ensureTaskTypes(organisationId);
    return prisma.crmTaskType.findMany({
      where: { organisationId, isActive: true },
      orderBy: { sortOrder: "asc" },
    });
  },
};
