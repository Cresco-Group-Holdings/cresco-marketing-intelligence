import { NextRequest } from "next/server";
import { apiSuccess, parseBody, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { z } from "zod";
import { gscConnectionService } from "@/server/services/gsc-connection-service";

const selectSiteSchema = z.object({
  siteUrl: z.string().min(1),
  siteLabel: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) {
    return apiSuccess({ error: "organisation_required" });
  }

  const input = parseBody(selectSiteSchema, await request.json());

  return withApiHandler(
    request,
    async ({ tenant, requestId }) =>
      apiSuccess(
        {
          result: await gscConnectionService.selectSite(
            brandId,
            tenant!.organisationId,
            input,
            tenant!,
          ),
        },
        { requestId },
      ),
    { organisationId, permission: PERMISSIONS["connectors.update"] },
  );
}
