import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { requireOrganisationId, withBillingManage } from "@/lib/api/billing-handler";
import { subscriptionService } from "@/server/services/subscription-service";

export async function POST(request: NextRequest) {
  const organisationId = requireOrganisationId(request);

  return withBillingManage(request, organisationId, async ({ requestId, tenant }) => {
    const result = await subscriptionService.reconcileWithStripe(tenant!);
    return apiSuccess(result, { requestId });
  });
}
