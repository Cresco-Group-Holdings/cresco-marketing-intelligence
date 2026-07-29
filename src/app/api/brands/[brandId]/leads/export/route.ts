import { NextRequest, NextResponse } from "next/server";
import { parseBody } from "@/lib/api/handler";
import {
  leadFilters,
  requireOrganisationId,
  withLeadsExport,
} from "@/lib/api/leads-handler";
import { leadExportSchema } from "@/lib/validation/leads";
import { marketingLeadQueryService } from "@/server/services/marketing-lead-query-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const filters = leadFilters(request);
  const { format } = parseBody(leadExportSchema, {
    format: request.nextUrl.searchParams.get("format"),
    qualifiedOnly: request.nextUrl.searchParams.get("qualifiedOnly"),
    status: request.nextUrl.searchParams.get("status"),
  });

  return withLeadsExport(request, organisationId, async ({ tenant }) => {
    const exported = await marketingLeadQueryService.export(
      brandId,
      organisationId,
      { ...filters, format },
      tenant!,
    );
    return new NextResponse(exported.body, {
      headers: {
        "content-type": exported.contentType,
        "content-disposition": `attachment; filename="leads.${format.toLowerCase()}"`,
      },
    });
  });
}
