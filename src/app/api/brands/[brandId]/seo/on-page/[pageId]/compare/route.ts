import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withOnPageRead } from "@/lib/api/on-page-handler";
import { comparisonSchema } from "@/lib/validation/on-page";
import { onPageComparisonService } from "@/server/services/on-page-comparison-service";

type Params = { params: Promise<{ brandId: string; pageId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, pageId } = await params;
  const organisationId = requireOrganisationId(request);
  return withOnPageRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { comparisons: await onPageComparisonService.listComparisons(pageId, brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, pageId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withOnPageRead(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(comparisonSchema, body);
    const comparison = await onPageComparisonService.compare(pageId, brandId, organisationId, input, tenant!);
    return apiSuccess({ comparison }, { requestId });
  });
}
