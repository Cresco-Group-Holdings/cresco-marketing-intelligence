import type { CrmActivityType, CrmActivityVisibility, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";
import { recordAuditEvent } from "@/server/services/audit-service";

const activityInclude = {
  loggedBy: { select: { id: true, displayName: true } },
  lead: { select: { id: true, status: true } },
  opportunity: { select: { id: true, name: true } },
  company: { select: { id: true, tradingName: true } },
  task: { select: { id: true, title: true, status: true } },
  participants: {
    include: {
      person: { select: { id: true, displayName: true } },
      user: { select: { id: true, displayName: true } },
    },
  },
  note: true,
  callLog: true,
  meetingRecord: true,
} satisfies Prisma.CrmActivityInclude;

export type LogActivityInput = {
  activityType: CrmActivityType;
  title: string;
  summary?: string;
  outcome?: string;
  nextAction?: string;
  durationMinutes?: number;
  visibility?: CrmActivityVisibility;
  leadId?: string;
  companyId?: string;
  opportunityId?: string;
  taskId?: string;
  formSubmissionId?: string;
  campaignId?: string;
  occurredAt?: string;
  participants?: Array<{ personId?: string; userId?: string; name?: string; role?: string }>;
  noteContent?: string;
  call?: { direction?: string; phoneNumber?: string; durationMinutes?: number; disposition?: string };
  meeting?: {
    scheduledAt?: string;
    durationMinutes?: number;
    location?: string;
    calendarProvider?: "GOOGLE" | "MICROSOFT" | "SCHEDULING_PROVIDER";
    externalEventId?: string;
    outcome?: string;
  };
};

export const crmActivityService = {
  async listActivities(
    brandId: string,
    organisationId: string,
    context: TenantContext,
    filters?: { leadId?: string; opportunityId?: string; activityType?: string },
  ) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.crmActivity.findMany({
      where: {
        organisationId,
        brandId,
        ...(filters?.leadId ? { leadId: filters.leadId } : {}),
        ...(filters?.opportunityId ? { opportunityId: filters.opportunityId } : {}),
        ...(filters?.activityType ? { activityType: filters.activityType as CrmActivityType } : {}),
      },
      include: activityInclude,
      orderBy: { occurredAt: "desc" },
      take: 200,
    });
  },

  async getActivity(activityId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const activity = await prisma.crmActivity.findFirst({
      where: { id: activityId, organisationId, brandId },
      include: activityInclude,
    });
    if (!activity) throw new AppError("NOT_FOUND", "Activity not found.");
    return activity;
  },

  async logActivity(brandId: string, organisationId: string, input: LogActivityInput, context: TenantContext) {
    const brand = await brandService.getById(brandId, organisationId, context);

    const activity = await prisma.$transaction(async (tx) => {
      const created = await tx.crmActivity.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          activityType: input.activityType,
          title: input.title,
          summary: input.summary,
          outcome: input.outcome,
          nextAction: input.nextAction,
          durationMinutes: input.durationMinutes,
          visibility: input.visibility ?? "STANDARD",
          loggedByUserId: context.userProfileId,
          leadId: input.leadId,
          companyId: input.companyId,
          opportunityId: input.opportunityId,
          taskId: input.taskId,
          formSubmissionId: input.formSubmissionId,
          campaignId: input.campaignId,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        },
      });

      if (input.participants?.length) {
        await tx.crmActivityParticipant.createMany({
          data: input.participants.map((p) => ({
            activityId: created.id,
            personId: p.personId,
            userId: p.userId,
            name: p.name,
            role: p.role,
          })),
        });
      }

      if (input.activityType === "NOTE" && input.noteContent) {
        await tx.crmNote.create({
          data: { activityId: created.id, content: input.noteContent, authorId: context.userProfileId },
        });
      }

      if (input.activityType === "CALL" && input.call) {
        await tx.crmCallLog.create({
          data: {
            activityId: created.id,
            direction: input.call.direction ?? "OUTBOUND",
            phoneNumber: input.call.phoneNumber,
            durationMinutes: input.call.durationMinutes ?? input.durationMinutes,
            disposition: input.call.disposition,
            loggedById: context.userProfileId,
          },
        });
      }

      if (input.activityType === "MEETING" && input.meeting) {
        await tx.crmMeetingRecord.create({
          data: {
            activityId: created.id,
            scheduledAt: input.meeting.scheduledAt ? new Date(input.meeting.scheduledAt) : null,
            durationMinutes: input.meeting.durationMinutes ?? input.durationMinutes,
            location: input.meeting.location,
            calendarProvider: input.meeting.calendarProvider,
            externalEventId: input.meeting.externalEventId,
            outcome: input.meeting.outcome ?? input.outcome,
            loggedById: context.userProfileId,
          },
        });
      }

      if (input.leadId) {
        await tx.crmLead.updateMany({
          where: { id: input.leadId, organisationId, brandId },
          data: { lastActivityAt: new Date() },
        });
      }

      if (input.opportunityId) {
        await tx.crmOpportunity.updateMany({
          where: { id: input.opportunityId, organisationId, brandId },
          data: {
            lastActivityAt: new Date(),
            ...(input.nextAction ? { nextAction: input.nextAction } : {}),
          },
        });
      }

      return tx.crmActivity.findUniqueOrThrow({
        where: { id: created.id },
        include: activityInclude,
      });
    });

    await recordAuditEvent({
      organisationId,
      actorUserId: context.userProfileId,
      action: "crm.activity.log",
      resourceType: "CrmActivity",
      resourceId: activity.id,
      metadata: { brandId, activityType: input.activityType, title: input.title },
    });

    return activity;
  },
};
