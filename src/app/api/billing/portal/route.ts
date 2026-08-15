import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withBillingManage } from "@/lib/api/billing-handler";
import { portalSchema } from "@/lib/validation/billing";
import { subscriptionService } from "@/server/services/subscription-service";

export async function POST(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  return withBillingManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(portalSchema, body);
    const result = await subscriptionService.openPortal(tenant!, input.returnUrl);
    return apiSuccess(result, { requestId });
  });
}
