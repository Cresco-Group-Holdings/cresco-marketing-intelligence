import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withLongFormRead } from "@/lib/api/long-form-handler";
import { longFormDocumentService } from "@/server/services/long-form-document-service";

type Params = { params: Promise<{ brandId: string; documentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, documentId } = await params;
  const organisationId = requireOrganisationId(request);
  return withLongFormRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      await longFormDocumentService.getHistory(documentId, brandId, organisationId, tenant!),
      { requestId },
    ),
  );
}
