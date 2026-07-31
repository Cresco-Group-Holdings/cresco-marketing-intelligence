import type {
  ContentActivityType,
  ContentAssignmentRole,
  ContentDeadlineStatus,
  ContentTaskStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { computeDeadlineStatus } from "@/lib/operations/deadlines";
import { DEFAULT_CHECKLIST_ITEMS } from "@/lib/operations/constants";
import { assertOrganisationScope, type TenantContext } from "@/lib/tenancy/context";
import type {
  AssignmentCreateInput,
  CampaignCreateInput,
  CampaignUpdateInput,
  DeadlineCreateInput,
  TaskCreateInput,
  TaskUpdateInput,
} from "@/lib/validation/operations";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";

type BrandScope = {
  organisationId: string;
  projectId: string;
  brandId: string;
};

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
    where: {
      organisationId,
      userId,
      status: "ACTIVE",
    },
  });
  if (!membership) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Assignments require an active organisation member.",
    );
  }
  return membership;
}

async function recordActivity(
  scope: BrandScope,
  activityType: ContentActivityType,
  summary: string,
  actorUserId: string,
  refs: {
    campaignId?: string | null;
    contentItemId?: string | null;
    taskId?: string | null;
  },
  metadata?: Prisma.InputJsonValue,
) {
  return prisma.contentActivity.create({
    data: {
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      brandId: scope.brandId,
      campaignId: refs.campaignId ?? undefined,
      contentItemId: refs.contentItemId ?? undefined,
      taskId: refs.taskId ?? undefined,
      activityType,
      actorUserId,
      summary,
      metadata,
    },
  });
}

function serializeDeadline(deadline: {
  id: string;
  deadlineType: string;
  dueAt: Date;
  status: ContentDeadlineStatus;
  completedAt: Date | null;
  reminderSentAt: Date | null;
}) {
  return {
    id: deadline.id,
    deadlineType: deadline.deadlineType,
    dueAt: deadline.dueAt.toISOString(),
    status: deadline.status,
    completedAt: deadline.completedAt?.toISOString() ?? null,
    reminderSentAt: deadline.reminderSentAt?.toISOString() ?? null,
    isOverdue: deadline.status === "OVERDUE",
  };
}

async function refreshDeadlineStatuses(brandId: string, organisationId: string) {
  const deadlines = await prisma.contentDeadline.findMany({
    where: {
      brandId,
      organisationId,
      status: { in: ["UPCOMING", "DUE_SOON", "OVERDUE"] },
    },
  });
  const now = new Date();
  await Promise.all(
    deadlines.map((deadline) => {
      const nextStatus = computeDeadlineStatus(deadline.dueAt, deadline.completedAt, now);
      if (nextStatus === deadline.status) return Promise.resolve();
      return prisma.contentDeadline.update({
        where: { id: deadline.id },
        data: { status: nextStatus },
      });
    }),
  );
}

export const contentOperationsService = {
  async listCampaigns(brandId: string, organisationId: string, context: TenantContext) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const campaigns = await prisma.contentCampaign.findMany({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        archivedAt: null,
      },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        _count: { select: { contentItems: true, tasks: true, members: true } },
      },
      orderBy: { startDate: "desc" },
    });
    return campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      objective: campaign.objective,
      status: campaign.status,
      startDate: campaign.startDate.toISOString(),
      endDate: campaign.endDate.toISOString(),
      targetPlatforms: campaign.targetPlatforms,
      owner: campaign.owner,
      contentItemCount: campaign._count.contentItems,
      taskCount: campaign._count.tasks,
      memberCount: campaign._count.members,
    }));
  },

  async getCampaign(
    brandId: string,
    organisationId: string,
    campaignId: string,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const campaign = await prisma.contentCampaign.findFirst({
      where: {
        id: campaignId,
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        archivedAt: null,
      },
      include: {
        owner: { select: { id: true, displayName: true, email: true } },
        members: {
          where: { removedAt: null },
          include: { user: { select: { id: true, displayName: true, email: true } } },
        },
        contentItems: {
          where: { archivedAt: null },
          select: { id: true, title: true, status: true, contentType: true },
          take: 50,
        },
        tasks: {
          orderBy: { dueAt: "asc" },
          include: {
            assignee: { select: { id: true, displayName: true, email: true } },
          },
        },
        deadlines: { orderBy: { dueAt: "asc" } },
        experiments: {
          select: { id: true, title: true, status: true },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 30,
          include: { actor: { select: { id: true, displayName: true, email: true } } },
        },
      },
    });
    if (!campaign) {
      throw new AppError("NOT_FOUND", "Campaign was not found.");
    }
    assertOrganisationScope(campaign.organisationId, context);
    await refreshDeadlineStatuses(scope.brandId, scope.organisationId);
    return {
      id: campaign.id,
      name: campaign.name,
      objective: campaign.objective,
      description: campaign.description,
      status: campaign.status,
      startDate: campaign.startDate.toISOString(),
      endDate: campaign.endDate.toISOString(),
      targetPlatforms: campaign.targetPlatforms,
      landingPageUrl: campaign.landingPageUrl,
      targetAudienceId: campaign.targetAudienceId,
      offerId: campaign.offerId,
      marketingObjectiveId: campaign.marketingObjectiveId,
      owner: campaign.owner,
      members: campaign.members.map((member) => ({
        id: member.id,
        user: member.user,
        role: member.role,
        addedAt: member.addedAt.toISOString(),
      })),
      contentItems: campaign.contentItems,
      tasks: campaign.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        dueAt: task.dueAt?.toISOString() ?? null,
        assignee: task.assignee,
      })),
      deadlines: campaign.deadlines.map(serializeDeadline),
      experiments: campaign.experiments,
      activities: campaign.activities.map((activity) => ({
        id: activity.id,
        activityType: activity.activityType,
        summary: activity.summary,
        createdAt: activity.createdAt.toISOString(),
        actor: activity.actor,
      })),
    };
  },

  async createCampaign(
    brandId: string,
    organisationId: string,
    input: CampaignCreateInput,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const ownerUserId = input.ownerUserId ?? context.userId;
    await assertActiveMember(scope.organisationId, ownerUserId);
    const memberIds = input.memberUserIds ?? [];
    for (const userId of memberIds) {
      await assertActiveMember(scope.organisationId, userId);
    }

    const campaign = await prisma.$transaction(async (tx) => {
      const created = await tx.contentCampaign.create({
        data: {
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          name: input.name,
          objective: input.objective || null,
          description: input.description || null,
          ownerUserId,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          targetPlatforms: input.targetPlatforms ?? [],
          targetAudienceId: input.targetAudienceId ?? null,
          offerId: input.offerId ?? null,
          landingPageUrl: input.landingPageUrl || null,
          status: input.status ?? "PLANNED",
          marketingObjectiveId: input.marketingObjectiveId ?? null,
          createdByUserId: context.userId,
        },
      });

      const uniqueMembers = [...new Set([ownerUserId, ...memberIds])];
      await tx.campaignMember.createMany({
        data: uniqueMembers.map((userId) => ({
          campaignId: created.id,
          userId,
          role: userId === ownerUserId ? "owner" : null,
        })),
      });

      await tx.contentActivity.create({
        data: {
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          campaignId: created.id,
          activityType: "CAMPAIGN_UPDATED",
          actorUserId: context.userId,
          summary: `Campaign "${created.name}" created.`,
        },
      });

      return created;
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      actorUserId: context.userId,
      action: "content.campaign.create",
      resourceType: "ContentCampaign",
      resourceId: campaign.id,
      metadata: { name: campaign.name },
    });

    return this.getCampaign(brandId, organisationId, campaign.id, context);
  },

  async updateCampaign(
    brandId: string,
    organisationId: string,
    campaignId: string,
    input: CampaignUpdateInput,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const existing = await prisma.contentCampaign.findFirst({
      where: {
        id: campaignId,
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        archivedAt: null,
      },
    });
    if (!existing) {
      throw new AppError("NOT_FOUND", "Campaign was not found.");
    }
    if (input.ownerUserId) {
      await assertActiveMember(scope.organisationId, input.ownerUserId);
    }

    await prisma.contentCampaign.update({
      where: { id: campaignId },
      data: {
        name: input.name,
        objective: input.objective,
        description: input.description,
        ownerUserId: input.ownerUserId,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        targetPlatforms: input.targetPlatforms,
        targetAudienceId: input.targetAudienceId,
        offerId: input.offerId,
        landingPageUrl: input.landingPageUrl,
        status: input.status,
        marketingObjectiveId: input.marketingObjectiveId,
      },
    });

    await recordActivity(
      scope,
      "CAMPAIGN_UPDATED",
      `Campaign "${input.name ?? existing.name}" updated.`,
      context.userId,
      { campaignId },
    );

    return this.getCampaign(brandId, organisationId, campaignId, context);
  },

  async listTasks(
    brandId: string,
    organisationId: string,
    filters: {
      campaignId?: string;
      assigneeUserId?: string;
      status?: ContentTaskStatus;
      overdueOnly?: boolean;
      myWork?: boolean;
    },
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    await refreshDeadlineStatuses(scope.brandId, scope.organisationId);

    const now = new Date();
    const assigneeUserId = filters.myWork ? context.userId : filters.assigneeUserId;
    const tasks = await prisma.contentTask.findMany({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        campaignId: filters.campaignId,
        assigneeUserId: assigneeUserId,
        status: filters.status,
        ...(filters.overdueOnly
          ? { dueAt: { lt: now }, status: { notIn: ["COMPLETED", "CANCELLED"] } }
          : {}),
      },
      include: {
        assignee: { select: { id: true, displayName: true, email: true } },
        owner: { select: { id: true, displayName: true, email: true } },
        campaign: { select: { id: true, name: true } },
        contentItem: { select: { id: true, title: true } },
        deadlines: true,
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    });

    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueAt: task.dueAt?.toISOString() ?? null,
      isOverdue:
        !!task.dueAt &&
        task.dueAt.getTime() < now.getTime() &&
        !["COMPLETED", "CANCELLED"].includes(task.status),
      assignee: task.assignee,
      owner: task.owner,
      campaign: task.campaign,
      contentItem: task.contentItem,
      deadlines: task.deadlines.map(serializeDeadline),
    }));
  },

  async createTask(
    brandId: string,
    organisationId: string,
    input: TaskCreateInput,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const ownerUserId = input.ownerUserId ?? context.userId;
    await assertActiveMember(scope.organisationId, ownerUserId);
    if (input.assigneeUserId) {
      await assertActiveMember(scope.organisationId, input.assigneeUserId);
    }

    const task = await prisma.contentTask.create({
      data: {
        organisationId: scope.organisationId,
        projectId: scope.projectId,
        brandId: scope.brandId,
        campaignId: input.campaignId ?? null,
        contentItemId: input.contentItemId ?? null,
        title: input.title,
        description: input.description || null,
        status: input.status ?? "TODO",
        assigneeUserId: input.assigneeUserId ?? null,
        ownerUserId,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        priority: input.priority ?? "NORMAL",
        createdByUserId: context.userId,
      },
    });

    const checklist = await prisma.contentChecklist.create({
      data: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        campaignId: input.campaignId ?? null,
        contentItemId: input.contentItemId ?? null,
        taskId: task.id,
        name: "Production checklist",
        items: {
          create: DEFAULT_CHECKLIST_ITEMS.map((item, index) => ({
            itemKey: item.itemKey,
            label: item.label,
            sortOrder: index,
          })),
        },
      },
      include: { items: true },
    });

    if (input.dueAt) {
      await prisma.contentDeadline.create({
        data: {
          organisationId: scope.organisationId,
          brandId: scope.brandId,
          campaignId: input.campaignId ?? null,
          contentItemId: input.contentItemId ?? null,
          taskId: task.id,
          deadlineType: "CONTENT_DUE",
          dueAt: new Date(input.dueAt),
          status: computeDeadlineStatus(new Date(input.dueAt), null),
        },
      });
    }

    await recordActivity(
      scope,
      "TASK_UPDATED",
      `Task "${task.title}" created.`,
      context.userId,
      { campaignId: input.campaignId, contentItemId: input.contentItemId, taskId: task.id },
    );

    return { task, checklist };
  },

  async updateTask(
    brandId: string,
    organisationId: string,
    taskId: string,
    input: TaskUpdateInput,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const existing = await prisma.contentTask.findFirst({
      where: {
        id: taskId,
        organisationId: scope.organisationId,
        brandId: scope.brandId,
      },
    });
    if (!existing) {
      throw new AppError("NOT_FOUND", "Task was not found.");
    }
    if (input.assigneeUserId) {
      await assertActiveMember(scope.organisationId, input.assigneeUserId);
    }
    if (input.ownerUserId) {
      await assertActiveMember(scope.organisationId, input.ownerUserId);
    }

    const previousStatus = existing.status;
    const task = await prisma.contentTask.update({
      where: { id: taskId },
      data: {
        title: input.title,
        description: input.description,
        campaignId: input.campaignId,
        contentItemId: input.contentItemId,
        status: input.status,
        assigneeUserId: input.assigneeUserId,
        ownerUserId: input.ownerUserId,
        dueAt: input.dueAt === null ? null : input.dueAt ? new Date(input.dueAt) : undefined,
        priority: input.priority,
      },
    });

    if (input.status && input.status !== previousStatus) {
      await recordActivity(
        scope,
        "STATUS_TRANSITION",
        `Task status changed from ${previousStatus} to ${input.status}.`,
        context.userId,
        {
          campaignId: task.campaignId,
          contentItemId: task.contentItemId,
          taskId: task.id,
        },
        { from: previousStatus, to: input.status },
      );
    } else {
      await recordActivity(
        scope,
        "TASK_UPDATED",
        `Task "${task.title}" updated.`,
        context.userId,
        {
          campaignId: task.campaignId,
          contentItemId: task.contentItemId,
          taskId: task.id,
        },
      );
    }

    return task;
  },

  async assignRole(
    brandId: string,
    organisationId: string,
    input: AssignmentCreateInput,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    await assertActiveMember(scope.organisationId, input.userId);

    const existing = await prisma.contentAssignment.findFirst({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        campaignId: input.campaignId ?? null,
        contentItemId: input.contentItemId ?? null,
        taskId: input.taskId ?? null,
        role: input.role,
        removedAt: null,
      },
    });

    if (existing) {
      if (existing.userId === input.userId) {
        return existing;
      }
      await prisma.contentAssignment.update({
        where: { id: existing.id },
        data: { removedAt: new Date() },
      });
    }

    const assignment = await prisma.contentAssignment.create({
      data: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        campaignId: input.campaignId ?? null,
        contentItemId: input.contentItemId ?? null,
        taskId: input.taskId ?? null,
        userId: input.userId,
        role: input.role,
        assignedByUserId: context.userId,
      },
      include: {
        user: { select: { id: true, displayName: true, email: true } },
      },
    });

    await recordActivity(
      scope,
      "ASSIGNMENT_CHANGED",
      `${input.role} assigned to ${assignment.user.displayName ?? assignment.user.email}.`,
      context.userId,
      {
        campaignId: input.campaignId,
        contentItemId: input.contentItemId,
        taskId: input.taskId,
      },
      { role: input.role, userId: input.userId },
    );

    return assignment;
  },

  async removeAssignment(
    brandId: string,
    organisationId: string,
    assignmentId: string,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const assignment = await prisma.contentAssignment.findFirst({
      where: {
        id: assignmentId,
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        removedAt: null,
      },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });
    if (!assignment) {
      throw new AppError("NOT_FOUND", "Assignment was not found.");
    }

    await prisma.contentAssignment.update({
      where: { id: assignmentId },
      data: { removedAt: new Date() },
    });

    await recordActivity(
      scope,
      "ASSIGNMENT_CHANGED",
      `${assignment.role} assignment removed for ${assignment.user.displayName ?? assignment.user.email}.`,
      context.userId,
      {
        campaignId: assignment.campaignId,
        contentItemId: assignment.contentItemId,
        taskId: assignment.taskId,
      },
      { role: assignment.role, userId: assignment.userId },
    );

    return { removed: true };
  },

  async createDeadline(
    brandId: string,
    organisationId: string,
    input: DeadlineCreateInput,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const dueAt = new Date(input.dueAt);
    const deadline = await prisma.contentDeadline.create({
      data: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        campaignId: input.campaignId ?? null,
        contentItemId: input.contentItemId ?? null,
        taskId: input.taskId ?? null,
        deadlineType: input.deadlineType,
        dueAt,
        status: computeDeadlineStatus(dueAt, null),
      },
    });

    await recordActivity(
      scope,
      "DEADLINE_SET",
      `${input.deadlineType} set for ${dueAt.toISOString()}.`,
      context.userId,
      {
        campaignId: input.campaignId,
        contentItemId: input.contentItemId,
        taskId: input.taskId,
      },
      { deadlineType: input.deadlineType, dueAt: input.dueAt },
    );

    return serializeDeadline(deadline);
  },

  async updateChecklistItem(
    brandId: string,
    organisationId: string,
    itemId: string,
    isCompleted: boolean,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const item = await prisma.contentChecklistItem.findFirst({
      where: {
        id: itemId,
        checklist: { organisationId: scope.organisationId, brandId: scope.brandId },
      },
      include: { checklist: true },
    });
    if (!item) {
      throw new AppError("NOT_FOUND", "Checklist item was not found.");
    }

    const updated = await prisma.contentChecklistItem.update({
      where: { id: itemId },
      data: {
        isCompleted,
        completedByUserId: isCompleted ? context.userId : null,
        completedAt: isCompleted ? new Date() : null,
      },
    });

    await recordActivity(
      scope,
      "CHECKLIST_UPDATED",
      `Checklist item "${item.label}" marked ${isCompleted ? "complete" : "incomplete"}.`,
      context.userId,
      {
        campaignId: item.checklist.campaignId,
        contentItemId: item.checklist.contentItemId,
        taskId: item.checklist.taskId,
      },
      { itemKey: item.itemKey, isCompleted },
    );

    return updated;
  },

  async getOperationsOverview(brandId: string, organisationId: string, context: TenantContext) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    await refreshDeadlineStatuses(scope.brandId, scope.organisationId);
    const now = new Date();

    const [campaigns, tasks, overdueDeadlines, overdueTasks, assignments, activities] =
      await Promise.all([
        prisma.contentCampaign.count({
          where: {
            organisationId: scope.organisationId,
            brandId: scope.brandId,
            archivedAt: null,
            status: { in: ["PLANNED", "ACTIVE"] },
          },
        }),
        prisma.contentTask.count({
          where: {
            organisationId: scope.organisationId,
            brandId: scope.brandId,
            status: { notIn: ["COMPLETED", "CANCELLED"] },
          },
        }),
        prisma.contentDeadline.count({
          where: {
            organisationId: scope.organisationId,
            brandId: scope.brandId,
            status: "OVERDUE",
          },
        }),
        prisma.contentTask.count({
          where: {
            organisationId: scope.organisationId,
            brandId: scope.brandId,
            dueAt: { lt: now },
            status: { notIn: ["COMPLETED", "CANCELLED"] },
          },
        }),
        prisma.contentAssignment.findMany({
          where: {
            organisationId: scope.organisationId,
            brandId: scope.brandId,
            removedAt: null,
          },
          include: { user: { select: { id: true, displayName: true, email: true } } },
          take: 20,
        }),
        prisma.contentActivity.findMany({
          where: { organisationId: scope.organisationId, brandId: scope.brandId },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { actor: { select: { id: true, displayName: true, email: true } } },
        }),
      ]);

    return {
      summary: {
        activeCampaigns: campaigns,
        openTasks: tasks,
        overdueDeadlines,
        overdueTasks,
      },
      assignments: assignments.map((assignment) => ({
        id: assignment.id,
        role: assignment.role,
        user: assignment.user,
        campaignId: assignment.campaignId,
        contentItemId: assignment.contentItemId,
        taskId: assignment.taskId,
      })),
      activities: activities.map((activity) => ({
        id: activity.id,
        activityType: activity.activityType,
        summary: activity.summary,
        createdAt: activity.createdAt.toISOString(),
        actor: activity.actor,
        campaignId: activity.campaignId,
        contentItemId: activity.contentItemId,
        taskId: activity.taskId,
      })),
    };
  },

  async listActivities(
    brandId: string,
    organisationId: string,
    filters: { campaignId?: string; contentItemId?: string; taskId?: string },
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const activities = await prisma.contentActivity.findMany({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        campaignId: filters.campaignId,
        contentItemId: filters.contentItemId,
        taskId: filters.taskId,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { actor: { select: { id: true, displayName: true, email: true } } },
    });
    return activities.map((activity) => ({
      id: activity.id,
      activityType: activity.activityType,
      summary: activity.summary,
      metadata: activity.metadata,
      createdAt: activity.createdAt.toISOString(),
      actor: activity.actor,
    }));
  },
};
