import { NextRequest } from "next/server";
import { apiSuccess, parseBody, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { z } from "zod";
import { ga4ConnectionService } from "@/server/services/ga4-connection-service";

const selectPropertySchema = z.object({
  accountName: z.string().min(1),
  propertyName: z.string().min(1),
  propertyDisplayName: z.string().min(1),
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

  const input = parseBody(selectPropertySchema, await request.json());

  return withApiHandler(
    request,
    async ({ tenant, requestId }) =>
      apiSuccess(
        {
          result: await ga4ConnectionService.selectProperty(
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
