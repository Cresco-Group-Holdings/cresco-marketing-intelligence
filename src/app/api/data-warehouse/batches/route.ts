import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  warehouseBatchesFilters,
  withWarehouseRead,
  withWarehouseWrite,
} from "@/lib/api/warehouse-handler";
import { warehouseCreateBatchSchema } from "@/lib/validation/warehouse";
import { marketingWarehouseIngestionService } from "@/server/services/marketing-warehouse-ingestion-service";
import { marketingWarehouseNormalisationService } from "@/server/services/marketing-warehouse-normalisation-service";

export async function GET(request: NextRequest) {
  const filters = warehouseBatchesFilters(request);

  return withWarehouseRead(request, async ({ requestId, tenant }) =>
    apiSuccess(
      await marketingWarehouseIngestionService.listBatches(
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
  const body = parseBody(warehouseCreateBatchSchema, await jsonBody(request));

  return withWarehouseWrite(request, async ({ requestId, tenant }) => {
    const batch = await marketingWarehouseIngestionService.createBatch(
      {
        brandId: body.brandId,
        organisationId: tenant!.organisationId,
        marketingDataSourceAccountId: body.marketingDataSourceAccountId,
        provider: body.provider,
        syncType: body.syncType,
        idempotencyKey: body.idempotencyKey,
        records: body.records,
      },
      tenant!,
      requestId,
    );

    if (body.records?.length) {
      await marketingWarehouseNormalisationService.normaliseBatch(batch.id, tenant!, requestId);
    }

    return apiSuccess(batch, { requestId });
  });
}
