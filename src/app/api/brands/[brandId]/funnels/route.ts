import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { funnelService } from "@/server/services/funnel-service";

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
      const funnels = await funnelService.listFunnels(brandId, organisationId, tenant!);
      return apiSuccess({ funnels }, { requestId });
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
    description?: string;
    countingMethod?: "USER" | "SESSION" | "EVENT";
    steps: Array<{
      name: string;
      stepType: string;
      matchingRules: Record<string, unknown>;
      maxTimeToNextStepMs?: number;
      requirement?: "REQUIRED" | "OPTIONAL";
    }>;
  };

  return withApiHandler(
    request,
    async ({ tenant, requestId }) => {
      const funnel = await funnelService.createFunnel(brandId, organisationId, body as never, tenant!);
      return apiSuccess({ funnel }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["marketingData.manageConversions"] },
  );
}
