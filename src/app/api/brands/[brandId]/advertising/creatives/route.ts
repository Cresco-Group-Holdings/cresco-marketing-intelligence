import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingCreativesCreate,
  withAdvertisingCreativesRead,
} from "@/lib/api/advertising-creatives-handler";
import { createCreativeProjectSchema } from "@/lib/validation/advertising-creatives";
import { advertisingCreativeProjectService } from "@/server/services/advertising-creative-project-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingCreativesRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ items: await advertisingCreativeProjectService.list(brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withAdvertisingCreativesCreate(request, organisationId, async ({ requestId, tenant, user }) => {
    if (!user?.userProfileId) throw new AppError("UNAUTHORIZED", "Authentication required.");
    const input = parseBody(createCreativeProjectSchema, body);
    const project = await advertisingCreativeProjectService.create(brandId, organisationId, input, tenant!);
    return apiSuccess({ project }, { requestId });
  });
}
