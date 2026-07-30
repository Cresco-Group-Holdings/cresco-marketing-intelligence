import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { attributionModelService } from "@/server/services/attribution-model-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) return apiSuccess({ error: "organisation_required" });

  return withApiHandler(
    request,
    async ({ tenant, requestId }) => {
      const models = await attributionModelService.listModels(brandId, organisationId, tenant!);
      return apiSuccess({ models }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["marketingData.read"] },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) return apiSuccess({ error: "organisation_required" });

  const body = (await request.json()) as {
    name: string;
    modelType: "FIRST_TOUCH" | "LAST_TOUCH" | "LINEAR" | "POSITION_BASED" | "TIME_DECAY";
    directTrafficPolicy?: "RETAIN" | "IGNORE_WHEN_PRIOR_KNOWN" | "SHOW_BOTH";
    lookbackWindowDays?: number;
    isDefault?: boolean;
  };

  return withApiHandler(
    request,
    async ({ tenant, requestId }) => {
      const model = await attributionModelService.createModel(
        brandId,
        organisationId,
        body,
        tenant!,
      );
      return apiSuccess({ model }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["marketingData.manageConversions"] },
  );
}
