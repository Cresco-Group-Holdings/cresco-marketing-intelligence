import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingExperimentsAnalyze,
  withAdvertisingExperimentsDecide,
  withAdvertisingExperimentsEdit,
  withAdvertisingExperimentsRead,
} from "@/lib/api/advertising-experiments-handler";
import { advertisingExperimentService } from "@/server/services/advertising-experiment-service";

type Params = { params: Promise<{ brandId: string; experimentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, experimentId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingExperimentsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ experiment: await advertisingExperimentService.getById(experimentId, brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, experimentId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "mark-ready") {
    return withAdvertisingExperimentsEdit(request, organisationId, async ({ requestId, tenant }) => {
      const experiment = await advertisingExperimentService.markReady(experimentId, brandId, organisationId, tenant!);
      return apiSuccess({ experiment }, { requestId });
    });
  }

  if (body.action === "start") {
    return withAdvertisingExperimentsEdit(request, organisationId, async ({ requestId, tenant }) => {
      const experiment = await advertisingExperimentService.start(experimentId, brandId, organisationId, tenant!);
      return apiSuccess({ experiment }, { requestId });
    });
  }

  if (body.action === "set-allocation") {
    return withAdvertisingExperimentsEdit(request, organisationId, async ({ requestId, tenant }) => {
      const allocation = await advertisingExperimentService.setAllocation(experimentId, brandId, organisationId, body, tenant!);
      return apiSuccess({ allocation }, { requestId });
    });
  }

  if (body.action === "record-observations") {
    return withAdvertisingExperimentsEdit(request, organisationId, async ({ requestId, tenant }) => {
      const observations = await advertisingExperimentService.recordObservations(experimentId, brandId, organisationId, body.observations, tenant!);
      return apiSuccess({ observations }, { requestId });
    });
  }

  if (body.action === "run-validity-checks") {
    return withAdvertisingExperimentsAnalyze(request, organisationId, async ({ requestId, tenant }) => {
      const checks = await advertisingExperimentService.runValidityChecks(experimentId, brandId, organisationId, tenant!);
      return apiSuccess({ checks }, { requestId });
    });
  }

  if (body.action === "analyze") {
    return withAdvertisingExperimentsAnalyze(request, organisationId, async ({ requestId, tenant }) => {
      const result = await advertisingExperimentService.analyze(experimentId, brandId, organisationId, tenant!);
      return apiSuccess(result, { requestId });
    });
  }

  if (body.action === "record-decision") {
    return withAdvertisingExperimentsDecide(request, organisationId, async ({ requestId, tenant }) => {
      const decision = await advertisingExperimentService.recordDecision(experimentId, brandId, organisationId, body, tenant!);
      return apiSuccess({ decision }, { requestId });
    });
  }

  if (body.action === "approve-decision") {
    return withAdvertisingExperimentsDecide(request, organisationId, async ({ requestId, tenant }) => {
      const decision = await advertisingExperimentService.approveDecision(experimentId, brandId, organisationId, tenant!);
      return apiSuccess({ decision }, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
}
