import { NextRequest, NextResponse } from "next/server";
import { parseBody } from "@/lib/api/handler";
import {
  analyticsAttributionFilters,
  requireOrganisationId,
  withAnalyticsRead,
} from "@/lib/api/analytics-handler";
import { socialAnalyticsExportSchema } from "@/lib/validation/social-analytics";
import { socialAnalyticsQueryService } from "@/server/services/social-analytics-query-service";
type Params = { params: Promise<{ brandId: string }> };
export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const { filters, dimension } = analyticsAttributionFilters(request);
  const { scope, format } = parseBody(
    socialAnalyticsExportSchema.pick({ scope: true, format: true }),
    {
      scope: request.nextUrl.searchParams.get("scope"),
      format: request.nextUrl.searchParams.get("format"),
    },
  );
  return withAnalyticsRead(request, organisationId, async ({ tenant }) => {
    const exported = await socialAnalyticsQueryService.export(
      brandId,
      organisationId,
      filters,
      scope,
      format,
      tenant!,
      dimension,
    );
    return new NextResponse(exported.body, {
      headers: {
        "content-type": exported.contentType,
        "content-disposition": `attachment; filename="social-${scope.toLowerCase()}.${format.toLowerCase()}"`,
      },
    });
  });
}
