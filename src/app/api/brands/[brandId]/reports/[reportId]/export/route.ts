import { NextRequest, NextResponse } from "next/server";
import { parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withReportsRead,
} from "@/lib/api/reports-handler";
import { socialReportExportSchema } from "@/lib/validation/social-reports";
import { socialReportService } from "@/server/services/social-report-service";

type Params = { params: Promise<{ brandId: string; reportId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, reportId } = await params;
  const organisationId = requireOrganisationId(request);
  const { format } = parseBody(
    socialReportExportSchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  return withReportsRead(request, organisationId, async ({ tenant }) => {
    const exported = await socialReportService.exportReport(
      brandId,
      organisationId,
      reportId,
      format,
      tenant!,
    );

    if (exported.encoding === "base64") {
      const buffer = Buffer.from(exported.body, "base64");
      return new NextResponse(buffer, {
        headers: {
          "content-type": exported.mimeType,
          "content-disposition": `attachment; filename="${exported.fileName}"`,
        },
      });
    }

    return new NextResponse(exported.body, {
      headers: {
        "content-type": exported.mimeType,
        "content-disposition": `attachment; filename="${exported.fileName}"`,
      },
    });
  });
}
