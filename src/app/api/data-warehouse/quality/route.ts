import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { withWarehouseQuality, withWarehouseRead } from "@/lib/api/warehouse-handler";
import {
  warehouseQualityListSchema,
  warehouseQualityResolveSchema,
} from "@/lib/validation/warehouse";
import { marketingWarehouseQualityService } from "@/server/services/marketing-warehouse-quality-service";

export async function GET(request: NextRequest) {
  const filters = parseBody(
    warehouseQualityListSchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  return withWarehouseRead(request, async ({ requestId, tenant }) =>
    apiSuccess(
      await marketingWarehouseQualityService.listIssues(
        filters.brandId,
        tenant!.organisationId,
        filters,
        tenant!,
      ),
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest) {
  const body = parseBody(warehouseQualityResolveSchema, await jsonBody(request));

  return withWarehouseQuality(request, async ({ requestId, tenant }) =>
    apiSuccess(
      await marketingWarehouseQualityService.resolveIssue(
        body.brandId,
        tenant!.organisationId,
        body,
        tenant!,
        requestId,
      ),
      { requestId },
    ),
  );
}
