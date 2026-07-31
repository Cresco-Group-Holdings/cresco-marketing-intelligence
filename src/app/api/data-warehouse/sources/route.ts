import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import { withWarehouseRead } from "@/lib/api/warehouse-handler";
import { warehouseSourcesListSchema } from "@/lib/validation/warehouse";
import { marketingWarehouseRegistryService } from "@/server/services/marketing-warehouse-registry-service";

export async function GET(request: NextRequest) {
  const filters = parseBody(
    warehouseSourcesListSchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  return withWarehouseRead(request, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        sources: await marketingWarehouseRegistryService.listSources(),
        accounts: await marketingWarehouseRegistryService.listAccounts(
          filters.brandId,
          tenant!.organisationId,
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}
