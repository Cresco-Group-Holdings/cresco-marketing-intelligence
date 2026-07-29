import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { withExperimentsWrite } from "@/lib/api/experiments-handler";
import { socialExperimentService } from "@/server/services/social-experiment-service";

type Params = { params: Promise<{ brandId: string; experimentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, experimentId } = await params;
  const action = request.nextUrl.searchParams.get("action");

  return withExperimentsWrite(request, async ({ requestId, tenant }) => {
    if (action === "ready") {
      return apiSuccess(
        {
          experiment: await socialExperimentService.markReady(
            brandId,
            tenant!.organisationId,
            experimentId,
            tenant!,
          ),
        },
        { requestId },
      );
    }

    if (action === "compute-results") {
      return apiSuccess(
        await socialExperimentService.computeResults(
          brandId,
          tenant!.organisationId,
          experimentId,
          tenant!,
        ),
        { requestId },
      );
    }

    throw new AppError("VALIDATION_ERROR", "Unsupported action.");
  });
}
