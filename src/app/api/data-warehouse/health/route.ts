import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import { withWarehouseRead } from "@/lib/api/warehouse-handler";
import { warehouseHealthListSchema } from "@/lib/validation/warehouse";
import { marketingWarehouseHealthService } from "@/server/services/marketing-warehouse-health-service";

export async function GET(request: NextRequest) {
  const filters = parseBody(
    warehouseHealthListSchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  return withWarehouseRead(request, async ({ requestId, tenant }) =>
    apiSuccess(
      await marketingWarehouseHealthService.listHealth(
        filters.brandId,
        tenant!.organisationId,
        tenant!,
      ),
      { requestId },
    ),
  );
}
