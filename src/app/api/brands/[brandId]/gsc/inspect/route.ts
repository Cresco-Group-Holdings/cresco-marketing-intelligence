import { NextRequest } from "next/server";
import { apiSuccess, parseBody, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { z } from "zod";
import { gscSyncService } from "@/server/services/gsc-sync-service";

const inspectSchema = z.object({
  inspectionUrl: z.string().url(),
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

  const input = parseBody(inspectSchema, await request.json());

  return withApiHandler(
    request,
    async ({ tenant, requestId, user }) =>
      apiSuccess(
        {
          inspection: await gscSyncService.inspectUrl(
            brandId,
            tenant!.organisationId,
            input.inspectionUrl,
            tenant!,
            user.userProfileId,
          ),
        },
        { requestId },
      ),
    { organisationId, permission: PERMISSIONS["connectors.update"] },
  );
}
