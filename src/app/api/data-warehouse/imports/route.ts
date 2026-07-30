import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { withWarehouseRead, withWarehouseWrite } from "@/lib/api/warehouse-handler";
import {
  warehouseImportsListSchema,
  warehouseManualImportCreateSchema,
} from "@/lib/validation/warehouse";
import { marketingManualImportService } from "@/server/services/marketing-manual-import-service";

export async function GET(request: NextRequest) {
  const filters = parseBody(
    warehouseImportsListSchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  return withWarehouseRead(request, async ({ requestId, tenant }) =>
    apiSuccess(
      await marketingManualImportService.listImports(
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
  const body = parseBody(warehouseManualImportCreateSchema, await jsonBody(request));

  return withWarehouseWrite(request, async ({ requestId, tenant }) =>
    apiSuccess(
      await marketingManualImportService.createImport(tenant!.organisationId, body, tenant!, requestId),
      { requestId },
    ),
  );
}
