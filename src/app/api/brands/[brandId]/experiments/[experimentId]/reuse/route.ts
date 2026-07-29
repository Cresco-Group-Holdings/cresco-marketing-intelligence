import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { withExperimentsWrite } from "@/lib/api/experiments-handler";
import { experimentReuseSchema } from "@/lib/validation/experiments";
import { experimentReuseService } from "@/server/services/experiment-reuse-service";

type Params = { params: Promise<{ brandId: string; experimentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, experimentId } = await params;
  const body = parseBody(experimentReuseSchema, await jsonBody(request));
  return withExperimentsWrite(request, async ({ requestId, tenant }) =>
    apiSuccess(
      await experimentReuseService.applyReuse(
        brandId,
        tenant!.organisationId,
        experimentId,
        body,
        tenant!,
      ),
      { requestId },
    ),
  );
}
