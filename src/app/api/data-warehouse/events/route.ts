import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { warehouseEventsFilters, withWarehouseRead } from "@/lib/api/warehouse-handler";
import { marketingWarehouseQueryService } from "@/server/services/marketing-warehouse-query-service";

export async function GET(request: NextRequest) {
  const filters = warehouseEventsFilters(request);

  return withWarehouseRead(request, async ({ requestId, tenant }) =>
    apiSuccess(
      await marketingWarehouseQueryService.queryEvents(tenant!.organisationId, filters, tenant!),
      { requestId },
    ),
  );
}
