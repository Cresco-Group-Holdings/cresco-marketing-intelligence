import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { requireOrganisationId, withBillingRead } from "@/lib/api/billing-handler";
import { subscriptionService } from "@/server/services/subscription-service";
import { usageMeteringService } from "@/server/services/usage-metering-service";
import { entitlementService } from "@/server/services/entitlement-service";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);

  return withBillingRead(request, organisationId, async ({ requestId, tenant }) => {
    const [summary, usage, entitlements] = await Promise.all([
      subscriptionService.getSubscriptionSummary(tenant!.organisationId),
      usageMeteringService.getUsageOverview(tenant!.organisationId),
      entitlementService.listEntitlements(tenant!.organisationId),
    ]);

    return apiSuccess({ summary, usage, entitlements }, { requestId });
  });
}
