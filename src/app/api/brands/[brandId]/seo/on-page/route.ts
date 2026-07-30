import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withOnPageManage, withOnPageRead } from "@/lib/api/on-page-handler";
import { createOnPageAuditSchema } from "@/lib/validation/on-page";
import { onPageAuditService } from "@/server/services/on-page-audit-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withOnPageRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ items: await onPageAuditService.list(brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withOnPageManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(createOnPageAuditSchema, body);
    const audit = await onPageAuditService.create(brandId, organisationId, input, tenant!);
    return apiSuccess({ audit }, { requestId });
  });
}
