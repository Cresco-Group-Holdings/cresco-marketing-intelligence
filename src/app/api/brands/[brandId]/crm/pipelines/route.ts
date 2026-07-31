import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withForecastRead,
  withOpportunitiesCreate,
  withOpportunitiesEdit,
  withOpportunitiesMarkLost,
  withOpportunitiesMarkWon,
  withOpportunitiesMove,
  withOpportunitiesRead,
  withPipelinesManage,
} from "@/lib/api/opportunities-handler";
import { crmOpportunityService } from "@/server/services/crm-opportunity-service";
import { crmPipelineService } from "@/server/services/crm-pipeline-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const url = request.nextUrl;
  const view = url.searchParams.get("view");
  const pipelineId = url.searchParams.get("pipelineId");
  const opportunityId = url.searchParams.get("opportunityId");

  if (view === "forecast") {
    return withForecastRead(request, organisationId, async ({ requestId, tenant }) => {
      const forecast = await crmOpportunityService.getForecast(brandId, organisationId, tenant!, pipelineId ?? undefined);
      return apiSuccess({ forecast }, { requestId });
    });
  }

  if (view === "health") {
    return withForecastRead(request, organisationId, async ({ requestId, tenant }) => {
      const health = await crmOpportunityService.getPipelineHealth(brandId, organisationId, tenant!, pipelineId ?? undefined);
      return apiSuccess({ health }, { requestId });
    });
  }

  if (view === "kanban" && pipelineId) {
    return withOpportunitiesRead(request, organisationId, async ({ requestId, tenant }) => {
      const kanban = await crmOpportunityService.getKanban(pipelineId, brandId, organisationId, tenant!);
      return apiSuccess({ kanban }, { requestId });
    });
  }

  if (view === "lossReasons") {
    return withOpportunitiesRead(request, organisationId, async ({ requestId, tenant }) => {
      const lossReasons = await crmPipelineService.listLossReasons(brandId, organisationId, tenant!);
      return apiSuccess({ lossReasons }, { requestId });
    });
  }

  if (opportunityId) {
    return withOpportunitiesRead(request, organisationId, async ({ requestId, tenant }) => {
      const opportunity = await crmOpportunityService.getOpportunity(opportunityId, brandId, organisationId, tenant!);
      return apiSuccess({ opportunity }, { requestId });
    });
  }

  if (pipelineId && !view) {
    return withOpportunitiesRead(request, organisationId, async ({ requestId, tenant }) => {
      const pipeline = await crmPipelineService.getPipeline(pipelineId, brandId, organisationId, tenant!);
      return apiSuccess({ pipeline }, { requestId });
    });
  }

  if (view === "pipelines" || url.searchParams.get("resource") === "pipelines") {
    return withOpportunitiesRead(request, organisationId, async ({ requestId, tenant }) => {
      const pipelines = await crmPipelineService.listPipelines(brandId, organisationId, tenant!);
      return apiSuccess({ pipelines }, { requestId });
    });
  }

  return withOpportunitiesRead(request, organisationId, async ({ requestId, tenant }) => {
    const opportunities = await crmOpportunityService.listOpportunities(brandId, organisationId, tenant!, {
      pipelineId: pipelineId ?? undefined,
      ownerUserId: url.searchParams.get("ownerUserId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
    });
    return apiSuccess({ opportunities }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  switch (body.action) {
    case "createPipeline":
      return withPipelinesManage(request, organisationId, async ({ requestId, tenant }) => {
        const pipeline = await crmPipelineService.createPipeline(brandId, organisationId, body, tenant!);
        return apiSuccess({ pipeline }, { requestId });
      });

    case "createVersion":
      return withPipelinesManage(request, organisationId, async ({ requestId, tenant }) => {
        const version = await crmPipelineService.createVersion(body.pipelineId, brandId, organisationId, tenant!);
        return apiSuccess({ version }, { requestId });
      });

    case "addStage":
      return withPipelinesManage(request, organisationId, async ({ requestId, tenant }) => {
        const stage = await crmPipelineService.addStage(body.pipelineId, brandId, organisationId, body, tenant!);
        return apiSuccess({ stage }, { requestId });
      });

    case "createLossReason":
      return withPipelinesManage(request, organisationId, async ({ requestId, tenant }) => {
        const reason = await crmPipelineService.createLossReason(brandId, organisationId, body, tenant!);
        return apiSuccess({ reason }, { requestId });
      });

    case "createOpportunity":
      return withOpportunitiesCreate(request, organisationId, async ({ requestId, tenant }) => {
        const opportunity = await crmOpportunityService.createOpportunity(brandId, organisationId, body, tenant!);
        return apiSuccess({ opportunity }, { requestId });
      });

    case "moveStage":
      return withOpportunitiesMove(request, organisationId, async ({ requestId, tenant }) => {
        const opportunity = await crmOpportunityService.moveStage(
          body.opportunityId, brandId, organisationId, body.newStageId, body.reason, tenant!,
        );
        return apiSuccess({ opportunity }, { requestId });
      });

    case "markWon":
      return withOpportunitiesMarkWon(request, organisationId, async ({ requestId, tenant }) => {
        const opportunity = await crmOpportunityService.markWon(
          body.opportunityId, brandId, organisationId, body, tenant!,
        );
        return apiSuccess({ opportunity }, { requestId });
      });

    case "markLost":
      return withOpportunitiesMarkLost(request, organisationId, async ({ requestId, tenant }) => {
        const opportunity = await crmOpportunityService.markLost(
          body.opportunityId, brandId, organisationId, body, tenant!,
        );
        return apiSuccess({ opportunity }, { requestId });
      });

    default:
      throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
  }
}
