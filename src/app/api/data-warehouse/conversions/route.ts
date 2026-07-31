import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { withWarehouseConversions, withWarehouseRead } from "@/lib/api/warehouse-handler";
import {
  warehouseConversionCreateSchema,
  warehouseConversionsQuerySchema,
} from "@/lib/validation/warehouse";
import { prisma } from "@/lib/database/prisma";
import { marketingWarehouseQueryService } from "@/server/services/marketing-warehouse-query-service";
import { brandService } from "@/server/services/workspace-service";

export async function GET(request: NextRequest) {
  const filters = parseBody(
    warehouseConversionsQuerySchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  return withWarehouseRead(request, async ({ requestId, tenant }) =>
    apiSuccess(
      await marketingWarehouseQueryService.listConversions(
        tenant!.organisationId,
        filters,
        tenant!,
      ),
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest) {
  const body = parseBody(warehouseConversionCreateSchema, await jsonBody(request));

  return withWarehouseConversions(request, async ({ requestId, tenant }) => {
    const brand = await brandService.getById(body.brandId, tenant!.organisationId, tenant!);
    const conversion = await prisma.marketingConversionDefinition.upsert({
      where: {
        brandId_provider_conversionKey: {
          brandId: body.brandId,
          provider: body.provider,
          conversionKey: body.conversionKey,
        },
      },
      create: {
        organisationId: tenant!.organisationId,
        projectId: brand.projectId,
        brandId: body.brandId,
        provider: body.provider,
        conversionKey: body.conversionKey,
        displayName: body.displayName,
        conversionType: body.conversionType,
        valueCurrency: body.valueCurrency,
      },
      update: {
        displayName: body.displayName,
        conversionType: body.conversionType,
        valueCurrency: body.valueCurrency,
        isActive: true,
      },
    });

    return apiSuccess(conversion, { requestId });
  });
}
