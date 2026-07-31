import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import { withWarehouseRead } from "@/lib/api/warehouse-handler";
import { warehouseCostsQuerySchema } from "@/lib/validation/warehouse";
import { marketingWarehouseQueryService } from "@/server/services/marketing-warehouse-query-service";

export async function GET(request: NextRequest) {
  const filters = parseBody(
    warehouseCostsQuerySchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  return withWarehouseRead(request, async ({ requestId, tenant }) =>
    apiSuccess(
      await marketingWarehouseQueryService.queryCosts(tenant!.organisationId, {
        brandId: filters.brandId,
        from: new Date(filters.from),
        to: new Date(filters.to),
        cursor: filters.cursor,
        limit: filters.limit,
        marketingCampaignId: filters.marketingCampaignId,
      }, tenant!),
      { requestId },
    ),
  );
}
