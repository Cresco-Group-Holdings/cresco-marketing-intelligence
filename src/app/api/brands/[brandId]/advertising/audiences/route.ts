import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingAudiencesCreate,
  withAdvertisingAudiencesRead,
} from "@/lib/api/advertising-audiences-handler";
import { createAudienceSchema } from "@/lib/validation/advertising-audiences";
import { advertisingAudienceService } from "@/server/services/advertising-audience-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingAudiencesRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ items: await advertisingAudienceService.list(brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withAdvertisingAudiencesCreate(request, organisationId, async ({ requestId, tenant, user }) => {
    if (!user?.userProfileId) throw new AppError("UNAUTHORIZED", "Authentication required.");
    const input = parseBody(createAudienceSchema, body);
    const audience = await advertisingAudienceService.create(brandId, organisationId, input, tenant!);
    return apiSuccess({ audience }, { requestId });
  });
}
