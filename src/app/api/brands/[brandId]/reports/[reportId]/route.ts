import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withReportsRead,
  withReportsWrite,
} from "@/lib/api/reports-handler";
import { socialReportShareSchema } from "@/lib/validation/social-reports";
import { socialReportService } from "@/server/services/social-report-service";

type Params = { params: Promise<{ brandId: string; reportId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, reportId } = await params;
  const organisationId = requireOrganisationId(request);

  return withReportsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await socialReportService.get(brandId, organisationId, reportId, tenant!),
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, reportId } = await params;
  const organisationId = requireOrganisationId(request);
  const action = request.nextUrl.searchParams.get("action");
  const body = parseBody(socialReportShareSchema, await jsonBody(request));

  return withReportsWrite(request, organisationId, async ({ requestId, tenant }) => {
    if (action !== "share") {
      throw new Error("Unsupported report action.");
    }
    return apiSuccess(
      await socialReportService.updateShare(
        brandId,
        organisationId,
        reportId,
        body.enable,
        body.expiresInDays,
        tenant!,
      ),
      { requestId },
    );
  });
}
