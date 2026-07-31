import { NextRequest } from "next/server";
import { parseBody, withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { operationsListFiltersSchema } from "@/lib/validation/operations";
import { ContentTaskStatus } from "@prisma/client";

export function requireOrganisationId(request: NextRequest) {
  const id =
    request.nextUrl.searchParams.get("organisationId") ?? request.headers.get("x-organisation-id");
  if (!id) throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  return id;
}

export const withOperationsRead = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["operations.read"],
  });

export const withOperationsWrite = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["operations.write"],
  });

export function operationsFilters(request: NextRequest) {
  const parsed = parseBody(
    operationsListFiltersSchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  return {
    ...parsed,
    status: parsed.status as ContentTaskStatus | undefined,
  };
}
