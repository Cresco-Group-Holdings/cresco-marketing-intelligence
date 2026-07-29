import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  inboxFilters,
  requireOrganisationId,
  withInboxRead,
} from "@/lib/api/inbox-handler";
import { socialInboxQueryService } from "@/server/services/social-inbox-query-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const filters = inboxFilters(request);

  return withInboxRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await socialInboxQueryService.getSummary(
        brandId,
        organisationId,
        {
          socialAccountId: filters.socialAccountId,
          provider: filters.provider,
        },
        tenant!,
      ),
      { requestId },
    ),
  );
}
