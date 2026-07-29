import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  experimentListFilters,
  withExperimentsRead,
  withExperimentsWrite,
} from "@/lib/api/experiments-handler";
import {
  experimentCreateSchema,
  experimentReuseSchema,
  experimentUpdateSchema,
} from "@/lib/validation/experiments";
import { socialExperimentService } from "@/server/services/social-experiment-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const filters = experimentListFilters(request);
  return withExperimentsRead(request, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        items: await socialExperimentService.list(
          brandId,
          tenant!.organisationId,
          filters,
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const body = parseBody(experimentCreateSchema, await jsonBody(request));
  return withExperimentsWrite(request, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        experiment: await socialExperimentService.create(
          brandId,
          tenant!.organisationId,
          body,
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}
