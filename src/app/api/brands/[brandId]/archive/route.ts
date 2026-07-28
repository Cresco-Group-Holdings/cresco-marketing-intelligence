import { NextRequest } from "next/server";
import { apiSuccess, getOrganisationIdFromRequest, withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { brandService } from "@/server/services";

type Params = { params: Promise<{ brandId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  return withApiHandler(
    request,
    async ({ requestId, tenant }) => {
      const brand = await brandService.archive(brandId, organisationId, tenant!, requestId);
      return apiSuccess({ brand }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["brands.archive"] },
  );
}
