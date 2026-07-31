import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withActivitiesCreate,
  withActivitiesRead,
  withAiFollowUpGenerate,
  withFollowUpsManage,
  withFollowUpsRead,
  withTasksAssign,
  withTasksComplete,
  withTasksCreate,
  withTasksEdit,
  withTasksRead,
} from "@/lib/api/crm-tasks-handler";
import { crmActivityService } from "@/server/services/crm-activity-service";
import { crmFollowUpService } from "@/server/services/crm-follow-up-service";
import { crmTaskService } from "@/server/services/crm-task-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const url = request.nextUrl;
  const view = url.searchParams.get("view");
  const taskId = url.searchParams.get("taskId");
  const activityId = url.searchParams.get("activityId");
  const resource = url.searchParams.get("resource");

  if (view === "activities" || resource === "activities") {
    return withActivitiesRead(request, organisationId, async ({ requestId, tenant }) => {
      const activities = await crmActivityService.listActivities(brandId, organisationId, tenant!, {
        leadId: url.searchParams.get("leadId") ?? undefined,
        opportunityId: url.searchParams.get("opportunityId") ?? undefined,
        activityType: url.searchParams.get("activityType") ?? undefined,
      });
      return apiSuccess({ activities }, { requestId });
    });
  }

  if (view === "follow-ups" || resource === "followUps") {
    return withFollowUpsRead(request, organisationId, async ({ requestId, tenant }) => {
      const [rules, suggestions] = await Promise.all([
        crmFollowUpService.listRules(brandId, organisationId, tenant!),
        crmFollowUpService.listSuggestions(brandId, organisationId, tenant!, url.searchParams.get("status") ?? "PENDING"),
      ]);
      return apiSuccess({ rules, suggestions }, { requestId });
    });
  }

  if (activityId) {
    return withActivitiesRead(request, organisationId, async ({ requestId, tenant }) => {
      const activity = await crmActivityService.getActivity(activityId, brandId, organisationId, tenant!);
      return apiSuccess({ activity }, { requestId });
    });
  }

  if (taskId) {
    return withTasksRead(request, organisationId, async ({ requestId, tenant }) => {
      const task = await crmTaskService.getTask(taskId, brandId, organisationId, tenant!);
      return apiSuccess({ task }, { requestId });
    });
  }

  if (view === "my") {
    return withTasksRead(request, organisationId, async ({ requestId, tenant }) => {
      const tasks = await crmTaskService.listTasks(brandId, organisationId, tenant!, {
        ownerUserId: tenant!.userProfileId,
      });
      return apiSuccess({ tasks }, { requestId });
    });
  }

  if (view === "overdue") {
    return withTasksRead(request, organisationId, async ({ requestId, tenant }) => {
      await crmTaskService.syncOverdueTasks(brandId, organisationId, tenant!);
      const tasks = await crmTaskService.listTasks(brandId, organisationId, tenant!, { overdueOnly: true });
      return apiSuccess({ tasks }, { requestId });
    });
  }

  if (view === "taskTypes") {
    return withTasksRead(request, organisationId, async ({ requestId, tenant }) => {
      const taskTypes = await crmTaskService.listTaskTypes(organisationId, tenant!);
      return apiSuccess({ taskTypes }, { requestId });
    });
  }

  return withTasksRead(request, organisationId, async ({ requestId, tenant }) => {
    const tasks = await crmTaskService.listTasks(brandId, organisationId, tenant!, {
      status: url.searchParams.get("status") ?? undefined,
      ownerUserId: url.searchParams.get("ownerUserId") ?? undefined,
      opportunityId: url.searchParams.get("opportunityId") ?? undefined,
      leadId: url.searchParams.get("leadId") ?? undefined,
    });
    return apiSuccess({ tasks }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  switch (body.action) {
    case "createTask":
      return withTasksCreate(request, organisationId, async ({ requestId, tenant }) => {
        const task = await crmTaskService.createTask(brandId, organisationId, body, tenant!);
        return apiSuccess({ task }, { requestId });
      });

    case "updateTask":
      return withTasksEdit(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.taskId) throw new AppError("VALIDATION_ERROR", "taskId is required.");
        const task = await crmTaskService.updateTask(body.taskId, brandId, organisationId, body, tenant!);
        return apiSuccess({ task }, { requestId });
      });

    case "assignTask":
      return withTasksAssign(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.taskId || !body.assigneeId) throw new AppError("VALIDATION_ERROR", "taskId and assigneeId are required.");
        const task = await crmTaskService.assignTask(body.taskId, brandId, organisationId, body, tenant!);
        return apiSuccess({ task }, { requestId });
      });

    case "completeTask":
      return withTasksComplete(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.taskId) throw new AppError("VALIDATION_ERROR", "taskId is required.");
        const task = await crmTaskService.completeTask(body.taskId, brandId, organisationId, body, tenant!);
        return apiSuccess({ task }, { requestId });
      });

    case "syncOverdue":
      return withTasksEdit(request, organisationId, async ({ requestId, tenant }) => {
        const result = await crmTaskService.syncOverdueTasks(brandId, organisationId, tenant!);
        return apiSuccess({ result }, { requestId });
      });

    case "logActivity":
      return withActivitiesCreate(request, organisationId, async ({ requestId, tenant }) => {
        const activity = await crmActivityService.logActivity(brandId, organisationId, body, tenant!);
        return apiSuccess({ activity }, { requestId });
      });

    case "createFollowUpRule":
      return withFollowUpsManage(request, organisationId, async ({ requestId, tenant }) => {
        const rule = await crmFollowUpService.createRule(brandId, organisationId, body, tenant!);
        return apiSuccess({ rule }, { requestId });
      });

    case "evaluateFollowUpRules":
      return withFollowUpsManage(request, organisationId, async ({ requestId, tenant }) => {
        const result = await crmFollowUpService.evaluateRules(brandId, organisationId, tenant!);
        return apiSuccess({ result }, { requestId });
      });

    case "generateAiSuggestion":
      return withAiFollowUpGenerate(request, organisationId, async ({ requestId, tenant }) => {
        const suggestion = await crmFollowUpService.generateAiSuggestion(brandId, organisationId, body, tenant!);
        return apiSuccess({ suggestion }, { requestId });
      });

    case "acceptSuggestion":
      return withFollowUpsManage(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.suggestionId) throw new AppError("VALIDATION_ERROR", "suggestionId is required.");
        const suggestion = await crmFollowUpService.acceptSuggestion(body.suggestionId, brandId, organisationId, tenant!);
        return apiSuccess({ suggestion }, { requestId });
      });

    case "dismissSuggestion":
      return withFollowUpsManage(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.suggestionId) throw new AppError("VALIDATION_ERROR", "suggestionId is required.");
        const suggestion = await crmFollowUpService.dismissSuggestion(body.suggestionId, brandId, organisationId, tenant!);
        return apiSuccess({ suggestion }, { requestId });
      });

    default:
      throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
  }
}
