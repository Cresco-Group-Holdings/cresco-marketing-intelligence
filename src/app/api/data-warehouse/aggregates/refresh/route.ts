import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { withWarehouseWrite } from "@/lib/api/warehouse-handler";
import { warehouseAggregateRefreshSchema } from "@/lib/validation/warehouse";
import { marketingWarehouseAggregateService } from "@/server/services/marketing-warehouse-aggregate-service";

export async function POST(request: NextRequest) {
  const body = parseBody(warehouseAggregateRefreshSchema, await jsonBody(request));

  return withWarehouseWrite(request, async ({ requestId, tenant }) =>
    apiSuccess(
      await marketingWarehouseAggregateService.refreshDailyAggregates(
        tenant!.organisationId,
        {
          brandId: body.brandId,
          from: new Date(body.from),
          to: new Date(body.to),
          metricKeys: body.metricKeys,
          idempotencyKey: body.idempotencyKey,
        },
        tenant!,
        requestId,
      ),
      { requestId },
    ),
  );
}
