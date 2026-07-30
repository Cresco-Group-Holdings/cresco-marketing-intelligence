import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingExperimentsCreate,
  withAdvertisingExperimentsRead,
} from "@/lib/api/advertising-experiments-handler";
import { advertisingExperimentService } from "@/server/services/advertising-experiment-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  return withAdvertisingExperimentsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ experiments: await advertisingExperimentService.list(brandId, organisationId, tenant!, { status }) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "create") {
    return withAdvertisingExperimentsCreate(request, organisationId, async ({ requestId, tenant }) => {
      const experiment = await advertisingExperimentService.create(brandId, organisationId, body, tenant!);
      return apiSuccess({ experiment }, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
}
