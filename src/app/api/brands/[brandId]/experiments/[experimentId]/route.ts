import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { withExperimentsRead, withExperimentsWrite } from "@/lib/api/experiments-handler";
import { experimentUpdateSchema } from "@/lib/validation/experiments";
import { socialExperimentService } from "@/server/services/social-experiment-service";

type Params = { params: Promise<{ brandId: string; experimentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, experimentId } = await params;
  return withExperimentsRead(request, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        experiment: await socialExperimentService.getById(
          brandId,
          tenant!.organisationId,
          experimentId,
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId, experimentId } = await params;
  const body = parseBody(experimentUpdateSchema, await jsonBody(request));
  return withExperimentsWrite(request, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        experiment: await socialExperimentService.update(
          brandId,
          tenant!.organisationId,
          experimentId,
          body,
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}
