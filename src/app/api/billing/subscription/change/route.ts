import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withBillingManage } from "@/lib/api/billing-handler";
import { changePlanSchema } from "@/lib/validation/billing";
import { subscriptionService } from "@/server/services/subscription-service";

export async function POST(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  return withBillingManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(changePlanSchema, body);
    const summary = await subscriptionService.changePlan(
      tenant!,
      input.planKey,
      input.billingInterval,
    );
    return apiSuccess({ summary }, { requestId });
  });
}
