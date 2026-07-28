import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withMarketingAssetsWrite,
} from "@/lib/api/marketing-assets-handler";
import { marketingAssetService } from "@/server/services";

type Params = { params: Promise<{ brandId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);

  return withMarketingAssetsWrite(request, organisationId, async ({ request, requestId, tenant }) => {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new AppError("VALIDATION_ERROR", "A file upload is required.");
    }

    const title = formData.get("title");
    const description = formData.get("description");
    const tags = formData.get("tags");

    const buffer = Buffer.from(await file.arrayBuffer());
    const asset = await marketingAssetService.upload(
      brandId,
      organisationId,
      {
        filename: file.name,
        buffer,
        title: typeof title === "string" ? title : undefined,
        description: typeof description === "string" ? description : undefined,
        tags:
          typeof tags === "string"
            ? tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean)
            : undefined,
      },
      tenant!,
      requestId,
    );

    return apiSuccess({ asset }, { requestId });
  });
}
