import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { requireOrganisationId, withBillingRead } from "@/lib/api/billing-handler";
import { isBillingSelfServiceAvailable } from "@/lib/billing/launch-policy";
import { subscriptionService } from "@/server/services/subscription-service";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);

  return withBillingRead(request, organisationId, async ({ requestId }) => {
    const plans = await subscriptionService.listPlans();
    return apiSuccess(
      {
        plans,
        selfServiceCheckoutEnabled: isBillingSelfServiceAvailable(),
      },
      { requestId },
    );
  });
}
