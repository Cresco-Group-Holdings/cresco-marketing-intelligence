import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  operationalAlertFilters,
  requireOrganisationId,
  withOperationsRead,
} from "@/lib/api/notifications-handler";
import { operationalAlertService } from "@/server/services/operational-alert-service";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const filters = operationalAlertFilters(request);

  return withOperationsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        summary: await operationalAlertService.summary(organisationId, tenant!),
        ...(await operationalAlertService.list(organisationId, filters, tenant!)),
      },
      { requestId },
    ),
  );
}
