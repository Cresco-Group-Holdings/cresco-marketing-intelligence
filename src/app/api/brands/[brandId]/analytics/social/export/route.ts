import { NextRequest, NextResponse } from "next/server";
import { parseBody } from "@/lib/api/handler";
import {
  analyticsFilters,
  requireOrganisationId,
  withAnalyticsRead,
} from "@/lib/api/analytics-handler";
import { socialAnalyticsExportSchema } from "@/lib/validation/social-analytics";
import { socialAnalyticsQueryService } from "@/server/services/social-analytics-query-service";
type Params = { params: Promise<{ brandId: string }> };
export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const base = analyticsFilters(request);
  const query = parseBody(socialAnalyticsExportSchema, {
    ...base,
    scope: request.nextUrl.searchParams.get("scope"),
    format: request.nextUrl.searchParams.get("format"),
  });
  return withAnalyticsRead(request, organisationId, async ({ tenant }) => {
    const exported = await socialAnalyticsQueryService.export(
      brandId,
      organisationId,
      { ...query, from: new Date(query.from), to: new Date(query.to) },
      query.scope,
      query.format,
      tenant!,
    );
    return new NextResponse(exported.body, {
      headers: {
        "content-type": exported.contentType,
        "content-disposition": `attachment; filename="social-${query.scope.toLowerCase()}.${query.format.toLowerCase()}"`,
      },
    });
  });
}
