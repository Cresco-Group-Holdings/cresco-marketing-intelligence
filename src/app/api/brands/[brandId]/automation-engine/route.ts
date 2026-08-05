import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAutomationEngineActivate,
  withAutomationEngineCreate,
  withAutomationEngineEdit,
  withAutomationEngineExecute,
  withAutomationEngineRead,
} from "@/lib/api/automation-engine-handler";
import {
  createWorkflowSchema,
  dispatchEventSchema,
  manualExecuteSchema,
  saveVersionSchema,
} from "@/lib/validation/automation-engine";
import { automationEngineExecutionService } from "@/server/services/automation-engine-execution-service";
import { automationEngineService } from "@/server/services/automation-engine-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const workflowId = request.nextUrl.searchParams.get("workflowId");
  const view = request.nextUrl.searchParams.get("view");

  return withAutomationEngineRead(request, organisationId, async ({ requestId, tenant }) => {
    if (workflowId && view === "executions") {
      const executions = await automationEngineService.listExecutions(
        workflowId,
        brandId,
        organisationId,
        tenant!,
      );
      return apiSuccess({ executions }, { requestId });
    }

    if (workflowId) {
      const workflow = await automationEngineService.getWorkflow(
        workflowId,
        brandId,
        organisationId,
        tenant!,
      );
      return apiSuccess({ workflow }, { requestId });
    }

    const workflows = await automationEngineService.listWorkflows(brandId, organisationId, tenant!);
    return apiSuccess({ workflows }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  switch (body.action) {
    case "createWorkflow": {
      const input = createWorkflowSchema.parse(body);
      return withAutomationEngineCreate(request, organisationId, async ({ requestId, tenant }) => {
        const workflow = await automationEngineService.createWorkflow(
          brandId,
          organisationId,
          input,
          tenant!,
        );
        return apiSuccess({ workflow }, { requestId });
      });
    }

    case "saveVersion": {
      const input = saveVersionSchema.parse(body);
      return withAutomationEngineEdit(request, organisationId, async ({ requestId, tenant }) => {
        const workflow = await automationEngineService.saveVersion(
          brandId,
          organisationId,
          input,
          tenant!,
        );
        return apiSuccess({ workflow }, { requestId });
      });
    }

    case "activateWorkflow":
      return withAutomationEngineActivate(request, organisationId, async ({ requestId, tenant }) => {
        const workflow = await automationEngineService.activateWorkflow(
          body.workflowId,
          brandId,
          organisationId,
          tenant!,
        );
        return apiSuccess({ workflow }, { requestId });
      });

    case "pauseWorkflow":
      return withAutomationEngineEdit(request, organisationId, async ({ requestId, tenant }) => {
        const workflow = await automationEngineService.pauseWorkflow(
          body.workflowId,
          brandId,
          organisationId,
          tenant!,
        );
        return apiSuccess({ workflow }, { requestId });
      });

    case "dryRun": {
      return withAutomationEngineExecute(request, organisationId, async ({ requestId, tenant }) => {
        const result = await automationEngineService.dryRunVersion(
          body.workflowId,
          brandId,
          organisationId,
          body.payload ?? {},
          tenant!,
        );
        return apiSuccess({ result }, { requestId });
      });
    }

    case "dispatchEvent": {
      const input = dispatchEventSchema.parse(body);
      return withAutomationEngineExecute(request, organisationId, async ({ requestId, tenant }) => {
        const result = await automationEngineExecutionService.dispatchEvent(
          brandId,
          organisationId,
          input,
          tenant!,
        );
        return apiSuccess(result, { requestId });
      });
    }

    case "manualExecute": {
      const input = manualExecuteSchema.parse(body);
      return withAutomationEngineExecute(request, organisationId, async ({ requestId, tenant }) => {
        const result = await automationEngineExecutionService.manualExecute(
          input.workflowId,
          brandId,
          organisationId,
          input.payload ?? {},
          tenant!,
          input.dryRun ?? false,
        );
        return apiSuccess(result, { requestId });
      });
    }

    default:
      throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
  }
}
