import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withReportsRead,
  withReportsWrite,
} from "@/lib/api/reports-handler";
import { socialReportScheduleSchema } from "@/lib/validation/social-reports";
import { socialReportService } from "@/server/services/social-report-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);

  return withReportsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(await socialReportService.listSchedules(brandId, organisationId, tenant!), {
      requestId,
    }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(socialReportScheduleSchema, await jsonBody(request));

  return withReportsWrite(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await socialReportService.createSchedule(brandId, organisationId, body, tenant!),
      { requestId },
    ),
  );
}
