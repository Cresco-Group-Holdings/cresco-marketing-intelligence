import { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { digitalAssetService } from "@/server/services";
import {
  apiSuccess,
  requireOrganisationId,
  withDigitalAssetsWrite,
  type BrandParams,
} from "@/lib/api/digital-assets-handler";

export async function POST(request: NextRequest, { params }: BrandParams) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);

  return withDigitalAssetsWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const formData = await request.formData();
    const file = formData.get("file");
    const name = formData.get("name");
    const description = formData.get("description");
    const type = formData.get("type");
    const campaignId = formData.get("campaignId");

    if (!(file instanceof File)) {
      throw new AppError("VALIDATION_ERROR", "File is required.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await digitalAssetService.upload(
      brandId,
      organisationId,
      {
        filename: file.name,
        buffer,
        name: typeof name === "string" ? name : undefined,
        description: typeof description === "string" ? description : undefined,
        type: typeof type === "string" ? (type as import("@prisma/client").DigitalAssetType) : undefined,
        campaignId: typeof campaignId === "string" ? campaignId : undefined,
      },
      tenant!,
      requestId,
    );

    return apiSuccess(result, { requestId });
  });
}
