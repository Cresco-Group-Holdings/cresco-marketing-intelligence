import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { requireOrganisationId, withBillingManage } from "@/lib/api/billing-handler";
import { subscriptionService } from "@/server/services/subscription-service";

export async function POST(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const body = (await request.json().catch(() => ({}))) as { immediate?: boolean };
  const immediate =
    body.immediate === true || request.nextUrl.searchParams.get("immediate") === "true";

  return withBillingManage(request, organisationId, async ({ requestId, tenant }) => {
    const summary = await subscriptionService.cancelSubscription(tenant!, immediate);
    return apiSuccess({ summary }, { requestId });
  });
}
