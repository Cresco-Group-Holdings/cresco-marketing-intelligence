import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { withWarehouseReprocess } from "@/lib/api/warehouse-handler";
import { warehouseReprocessSchema } from "@/lib/validation/warehouse";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { incrementWarehouseCounter } from "@/lib/warehouse/observability";
import { marketingWarehouseIngestionService } from "@/server/services/marketing-warehouse-ingestion-service";
import { marketingWarehouseNormalisationService } from "@/server/services/marketing-warehouse-normalisation-service";

export async function POST(request: NextRequest) {
  const body = parseBody(warehouseReprocessSchema, await jsonBody(request));

  return withWarehouseReprocess(request, async ({ requestId, tenant }) => {
    if (body.batchId) {
      const batch = await prisma.rawMarketingBatch.findFirst({
        where: { id: body.batchId, organisationId: tenant!.organisationId, brandId: body.brandId },
      });
      if (!batch) {
        throw new AppError("NOT_FOUND", "Batch was not found.");
      }

      await prisma.rawMarketingRecord.updateMany({
        where: {
          rawMarketingBatchId: batch.id,
          ...(body.recordIds?.length ? { id: { in: body.recordIds } } : {}),
        },
        data: { status: "RECEIVED" },
      });

      const result = await marketingWarehouseNormalisationService.normaliseBatch(
        batch.id,
        tenant!,
        requestId,
      );
      incrementWarehouseCounter("warehouse.reprocess_runs");
      return apiSuccess({ batchId: batch.id, ...result }, { requestId });
    }

    const reprocessBatch = await marketingWarehouseIngestionService.createBatch(
      {
        brandId: body.brandId,
        organisationId: tenant!.organisationId,
        syncType: "REPROCESS",
        idempotencyKey: body.idempotencyKey,
      },
      tenant!,
      requestId,
    );

    incrementWarehouseCounter("warehouse.reprocess_runs");
    return apiSuccess(reprocessBatch, { requestId });
  });
}
