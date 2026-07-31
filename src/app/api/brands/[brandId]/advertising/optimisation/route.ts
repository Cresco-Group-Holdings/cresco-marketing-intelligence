import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingOptimisationRead,
  withAdvertisingOptimisationRun,
} from "@/lib/api/advertising-optimisation-handler";
import { advertisingOptimisationService } from "@/server/services/advertising-optimisation-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const reviewType = request.nextUrl.searchParams.get("reviewType") ?? undefined;
  return withAdvertisingOptimisationRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ runs: await advertisingOptimisationService.listRuns(brandId, organisationId, tenant!, { reviewType }) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "startRun") {
    return withAdvertisingOptimisationRun(request, organisationId, async ({ requestId, tenant }) => {
      const run = await advertisingOptimisationService.startRun(brandId, organisationId, body, tenant!);
      return apiSuccess({ run }, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
}
