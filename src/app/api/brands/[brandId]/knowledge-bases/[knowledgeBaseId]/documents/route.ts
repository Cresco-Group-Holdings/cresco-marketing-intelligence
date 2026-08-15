import { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { knowledgeBaseService } from "@/server/services";
import {
  apiSuccess,
  requireOrganisationId,
  withKnowledgeBaseRead,
  withKnowledgeBaseWrite,
  type BrandKbParams,
} from "@/lib/api/knowledge-base-handler";

export async function GET(request: NextRequest, { params }: BrandKbParams) {
  const { brandId, knowledgeBaseId } = await params;
  const organisationId = requireOrganisationId(request);

  return withKnowledgeBaseRead(request, organisationId, async ({ tenant }) => {
    const documents = await knowledgeBaseService.documents.list(
      brandId,
      organisationId,
      knowledgeBaseId,
      tenant!,
    );
    return apiSuccess({ documents });
  });
}

export async function POST(request: NextRequest, { params }: BrandKbParams) {
  const { brandId, knowledgeBaseId } = await params;
  const organisationId = requireOrganisationId(request);

  return withKnowledgeBaseWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const formData = await request.formData();
    const file = formData.get("file");
    const title = formData.get("title");
    const entryId = formData.get("entryId");

    if (!(file instanceof File)) {
      throw new Error("File is required.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const document = await knowledgeBaseService.documents.upload(
      brandId,
      organisationId,
      knowledgeBaseId,
      {
        filename: file.name,
        buffer,
        title: typeof title === "string" ? title : undefined,
        entryId: typeof entryId === "string" ? entryId : undefined,
      },
      tenant!,
      requestId,
    );
    return apiSuccess({ document }, { requestId });
  });
}
