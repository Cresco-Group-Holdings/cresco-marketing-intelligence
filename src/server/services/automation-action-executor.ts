import type { AutomationActionType, OrganisationRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { canTransitionCampaignStatus, validateActionConfig } from "@/lib/automation-engine/actions";
import { AUTOMATION_ACTION_CLASSIFICATION } from "@/lib/automation-engine/action-classification";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { crmActivityService } from "@/server/services/crm-activity-service";
import { crmService } from "@/server/services/crm-service";
import { crmTaskService } from "@/server/services/crm-task-service";
import { notificationService } from "@/server/services/notification-service";

export type AutomationActionContext = {
  organisationId: string;
  projectId: string;
  brandId: string;
  userProfileId: string;
  payload: Record<string, unknown>;
  dryRun: boolean;
};

export type AutomationActionResult = {
  actionType: AutomationActionType;
  classification: (typeof AUTOMATION_ACTION_CLASSIFICATION)[AutomationActionType];
  result?: Record<string, unknown>;
  recommendationOnly?: boolean;
  awaitingApproval?: boolean;
};

/** Canonical automation action executor — routes actions to domain services with permission checks. */
export const automationActionExecutor = {
  classify(actionType: AutomationActionType) {
    return AUTOMATION_ACTION_CLASSIFICATION[actionType];
  },

  async execute(
    actionType: AutomationActionType,
    config: Record<string, unknown>,
    ctx: AutomationActionContext,
  ): Promise<Record<string, unknown>> {
    const classification = AUTOMATION_ACTION_CLASSIFICATION[actionType];
    if (classification === "not_implemented") {
      throw new AppError("VALIDATION_ERROR", `Action type ${actionType} is not implemented.`);
    }

    const validation = validateActionConfig(actionType, config);
    if (!validation.valid) {
      throw new AppError("VALIDATION_ERROR", validation.errors.join(" "));
    }

    if (ctx.dryRun) {
      return { dryRun: true, actionType, classification, configKeys: Object.keys(config) };
    }

    if (classification === "recommendation_only") {
      return {
        recommendationOnly: true,
        actionType,
        summary: config.summary ?? config.title ?? "Recommendation recorded.",
      };
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
        return { taskId: task.id, executed: true };
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
        return { campaignId: updated.id, status: updated.status, executed: true };
      }
      case "ASSIGN_USER": {
        const userId = String(config.userId);
        const resourceType = String(config.resourceType);
        const resourceId = String(config.resourceId);
        if (resourceType === "LEAD") {
          await crmService.assignOwner(resourceId, ctx.brandId, ctx.organisationId, userId, tenant);
          return { resourceType, resourceId, userId, executed: true };
        }
        if (resourceType === "TASK") {
          await prisma.crmTask.update({
            where: { id: resourceId },
            data: { ownerUserId: userId },
          });
          return { resourceType, resourceId, userId, executed: true };
        }
        if (resourceType === "CAMPAIGN") {
          await prisma.contentCampaign.update({
            where: { id: resourceId },
            data: { ownerUserId: userId },
          });
          return { resourceType, resourceId, userId, executed: true };
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
          return { approvalId: approval.id, awaitingApproval: true };
        }
        await notificationService.emit({
          organisationId: ctx.organisationId,
          projectId: ctx.projectId,
          brandId: ctx.brandId,
          eventType: "APPROVAL_REQUESTED",
          title: String(config.title ?? "Approval requested"),
          body: String(config.body ?? "An automation workflow requested approval."),
          recipientUserIds: [approverUserId],
          idempotencyKey: `automation-approval:${ctx.brandId}:${approverUserId}:${String(config.idempotencyKey ?? Date.now())}`,
        });
        return { notified: approverUserId, awaitingApproval: true };
      }
      case "CREATE_NOTIFICATION": {
        let title = String(config.title);
        let body = String(config.body ?? "");
        let recipientUserIds = (config.recipientUserIds as string[]) ?? [];

        if (config.generateWeeklyDigest === true) {
          const { weeklyMarketingDigestService } = await import(
            "@/server/services/weekly-marketing-digest-service"
          );
          const digest = await weeklyMarketingDigestService.generate(
            ctx.organisationId,
            ctx.brandId,
            ctx.userProfileId,
          );
          title = "Weekly marketing digest is ready";
          body = digest.summary;
        }

        if (recipientUserIds.length === 0) {
          const admins = await prisma.organisationMembership.findMany({
            where: {
              organisationId: ctx.organisationId,
              role: { in: ["OWNER", "ADMIN"] },
              status: "ACTIVE",
            },
            select: { userId: true },
            take: 10,
          });
          recipientUserIds = admins.map((member) => member.userId);
        }

        await notificationService.emit({
          organisationId: ctx.organisationId,
          projectId: ctx.projectId,
          brandId: ctx.brandId,
          eventType: String(config.eventType ?? "SYSTEM"),
          title,
          body,
          recipientUserIds,
          actionPath: config.actionPath ? String(config.actionPath) : "/dashboard",
          idempotencyKey: String(config.idempotencyKey ?? `automation-notify:${Date.now()}`),
        });
        return { recipientCount: recipientUserIds.length, executed: true };
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
        return { activityId: activity.id, executed: true };
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
        return { leadId: lead.id, status: lead.status, executed: true };
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
        return { activityId: activity.id, executed: true };
      }
      default:
        throw new AppError("VALIDATION_ERROR", `Unsupported action type: ${actionType}`);
    }
  },
};
