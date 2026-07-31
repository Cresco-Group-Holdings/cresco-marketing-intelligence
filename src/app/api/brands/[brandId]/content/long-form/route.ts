import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withLongFormManage, withLongFormRead } from "@/lib/api/long-form-handler";
import { createLongFormDocumentSchema } from "@/lib/validation/long-form";
import { longFormDocumentService } from "@/server/services/long-form-document-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  return withLongFormRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { items: await longFormDocumentService.list(brandId, organisationId, tenant!, { status }) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withLongFormManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(createLongFormDocumentSchema, body);
    const document = await longFormDocumentService.createFromBrief(brandId, organisationId, input, tenant!);
    return apiSuccess({ document }, { requestId });
  });
}
