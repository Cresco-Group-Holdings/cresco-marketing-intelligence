import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withLongFormExport, withLongFormRead } from "@/lib/api/long-form-handler";
import { exportSchema } from "@/lib/validation/long-form";
import { longFormExportService } from "@/server/services/long-form-export-service";
import { longFormReviewService } from "@/server/services/long-form-review-service";

type Params = { params: Promise<{ brandId: string; documentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, documentId } = await params;
  const organisationId = requireOrganisationId(request);
  return withLongFormRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        summary: await longFormReviewService.getReviewSummary(documentId, brandId, organisationId, tenant!),
        exports: await longFormExportService.listExports(documentId, brandId, organisationId, tenant!),
      },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, documentId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withLongFormExport(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(exportSchema, body);
    const result = await longFormExportService.export(
      documentId,
      brandId,
      organisationId,
      input.format,
      tenant!,
    );
    return apiSuccess(result, { requestId });
  });
}
