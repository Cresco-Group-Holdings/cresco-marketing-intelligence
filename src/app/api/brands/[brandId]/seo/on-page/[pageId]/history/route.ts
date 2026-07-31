import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withOnPageRead } from "@/lib/api/on-page-handler";
import { onPageAuditService } from "@/server/services/on-page-audit-service";

type Params = { params: Promise<{ brandId: string; pageId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, pageId } = await params;
  const organisationId = requireOrganisationId(request);
  return withOnPageRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { versions: await onPageAuditService.getHistory(pageId, brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}
