import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import { withTrackingManage, withTrackingRead } from "@/lib/api/tracking-handler";
import { trackingPropertyCreateSchema } from "@/lib/validation/tracking";
import { trackingPropertyService } from "@/server/services/tracking-ingestion-service";

export async function GET(request: NextRequest) {
  const brandId = request.nextUrl.searchParams.get("brandId");
  if (!brandId) {
    return apiSuccess({ items: [] });
  }

  return withTrackingRead(request, async ({ tenant, requestId }) =>
    apiSuccess(
      {
        items: await trackingPropertyService.listProperties(
          brandId,
          tenant!.organisationId,
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest) {
  const input = parseBody(trackingPropertyCreateSchema, await request.json());

  return withTrackingManage(request, async ({ tenant, requestId }) =>
    apiSuccess(
      {
        property: await trackingPropertyService.createProperty(
          tenant!.organisationId,
          input,
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}
