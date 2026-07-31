import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { warehouseMetricsFilters, withWarehouseRead } from "@/lib/api/warehouse-handler";
import { marketingWarehouseQueryService } from "@/server/services/marketing-warehouse-query-service";

export async function GET(request: NextRequest) {
  const filters = warehouseMetricsFilters(request);

  return withWarehouseRead(request, async ({ requestId, tenant }) =>
    apiSuccess(
      await marketingWarehouseQueryService.queryMetrics(tenant!.organisationId, filters, tenant!),
      { requestId },
    ),
  );
}
