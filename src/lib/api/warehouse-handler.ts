import { NextRequest } from "next/server";
import { withApiHandler, parseBody } from "@/lib/api/handler";
import { createRequestId, handleApiError } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import {
  warehouseBatchesListSchema,
  warehouseEventsQuerySchema,
  warehouseMetricsQuerySchema,
} from "@/lib/validation/warehouse";

export function requireOrganisationId(request: NextRequest) {
  const id =
    request.nextUrl.searchParams.get("organisationId") ?? request.headers.get("x-organisation-id");
  if (!id) throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  return id;
}

async function withWarehousePermission(
  request: NextRequest,
  permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS],
  handler: Parameters<typeof withApiHandler>[1],
) {
  const requestId = createRequestId();
  try {
    const organisationId = requireOrganisationId(request);
    return withApiHandler(request, handler, {
      organisationId,
      permission,
    });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export const withWarehouseRead = (
  request: NextRequest,
  handler: Parameters<typeof withApiHandler>[1],
) => withWarehousePermission(request, PERMISSIONS["marketingData.read"], handler);

export const withWarehouseWrite = (
  request: NextRequest,
  handler: Parameters<typeof withApiHandler>[1],
) => withWarehousePermission(request, PERMISSIONS["marketingData.runSync"], handler);

export const withWarehouseManage = (
  request: NextRequest,
  handler: Parameters<typeof withApiHandler>[1],
) => withWarehousePermission(request, PERMISSIONS["marketingData.manageSources"], handler);

export const withWarehouseViewRaw = (
  request: NextRequest,
  handler: Parameters<typeof withApiHandler>[1],
) => withWarehousePermission(request, PERMISSIONS["marketingData.viewRaw"], handler);

export const withWarehouseExport = (
  request: NextRequest,
  handler: Parameters<typeof withApiHandler>[1],
) => withWarehousePermission(request, PERMISSIONS["marketingData.export"], handler);

export const withWarehouseQuality = (
  request: NextRequest,
  handler: Parameters<typeof withApiHandler>[1],
) => withWarehousePermission(request, PERMISSIONS["marketingData.manageQuality"], handler);

export const withWarehouseConversions = (
  request: NextRequest,
  handler: Parameters<typeof withApiHandler>[1],
) => withWarehousePermission(request, PERMISSIONS["marketingData.manageConversions"], handler);

export const withWarehouseReprocess = (
  request: NextRequest,
  handler: Parameters<typeof withApiHandler>[1],
) => withWarehousePermission(request, PERMISSIONS["marketingData.reprocess"], handler);

export function warehouseMetricsFilters(request: NextRequest) {
  const parsed = parseBody(
    warehouseMetricsQuerySchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  return {
    ...parsed,
    from: new Date(parsed.from),
    to: new Date(parsed.to),
  };
}

export function warehouseEventsFilters(request: NextRequest) {
  const parsed = parseBody(
    warehouseEventsQuerySchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  return {
    ...parsed,
    from: new Date(parsed.from),
    to: new Date(parsed.to),
  };
}

export function warehouseBatchesFilters(request: NextRequest) {
  return parseBody(
    warehouseBatchesListSchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
}
