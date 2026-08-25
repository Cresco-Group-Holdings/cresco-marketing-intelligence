import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withOperationsRead } from "@/lib/api/operations-handler";
import { schedulerHealthService } from "@/server/services/scheduler-health-service";

type Params = { params: Promise<Record<string, never>> };

export async function GET(request: NextRequest, _context: Params) {
  const organisationId = requireOrganisationId(request);

  return withOperationsRead(request, organisationId, async ({ requestId }) => {
    const health = await schedulerHealthService.getHealth();
    await schedulerHealthService.evaluateSchedulerAlerts();
    return apiSuccess({ scheduler: health }, { requestId });
  });
}
