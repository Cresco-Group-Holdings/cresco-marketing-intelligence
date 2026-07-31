import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { withWarehouseWrite } from "@/lib/api/warehouse-handler";
import { warehouseManualImportConfirmSchema } from "@/lib/validation/warehouse";
import { marketingManualImportService } from "@/server/services/marketing-manual-import-service";

type Params = { params: Promise<{ importId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { importId } = await params;
  const body = parseBody(warehouseManualImportConfirmSchema, await jsonBody(request));

  return withWarehouseWrite(request, async ({ requestId, tenant }) =>
    apiSuccess(
      await marketingManualImportService.confirmImport(
        tenant!.organisationId,
        { ...body, importId },
        tenant!,
        requestId,
      ),
      { requestId },
    ),
  );
}
