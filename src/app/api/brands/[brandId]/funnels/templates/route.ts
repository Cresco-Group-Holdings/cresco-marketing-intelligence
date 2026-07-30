import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { funnelService } from "@/server/services/funnel-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) return apiSuccess({ error: "organisation_required" });

  const body = (await request.json()) as {
    templateType: "CRESCO_GRANTS" | "CAPITAL_CRESCO_TERMINAL";
  };

  return withApiHandler(
    request,
    async ({ tenant, requestId }) => {
      const funnel = await funnelService.createFromTemplate(
        brandId,
        organisationId,
        body.templateType,
        tenant!,
      );
      return apiSuccess({ funnel }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["marketingData.manageConversions"] },
  );
}
