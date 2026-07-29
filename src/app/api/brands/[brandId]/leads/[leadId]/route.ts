import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withLeadsDelete,
  withLeadsRead,
} from "@/lib/api/leads-handler";
import { marketingLeadQueryService } from "@/server/services/marketing-lead-query-service";
import { leadPrivacyService } from "@/server/services/lead-privacy-service";

type Params = { params: Promise<{ brandId: string; leadId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, leadId } = await params;
  const organisationId = requireOrganisationId(request);

  return withLeadsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await marketingLeadQueryService.getById(brandId, organisationId, leadId, tenant!),
      { requestId },
    ),
  );
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { brandId, leadId } = await params;
  const organisationId = requireOrganisationId(request);
  const reason = request.nextUrl.searchParams.get("reason") ?? undefined;

  return withLeadsDelete(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        lead: await leadPrivacyService.deleteLead(
          brandId,
          organisationId,
          leadId,
          tenant!,
          reason,
        ),
      },
      { requestId },
    ),
  );
}
