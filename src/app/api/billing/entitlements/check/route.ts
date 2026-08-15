import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withBillingRead } from "@/lib/api/billing-handler";
import { entitlementCheckSchema } from "@/lib/validation/billing";
import { entitlementService } from "@/server/services/entitlement-service";

export async function POST(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  return withBillingRead(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(entitlementCheckSchema, body);
    const result = await entitlementService.check({
      workspaceId: tenant!.organisationId,
      organisationId: tenant!.organisationId,
      entitlement: input.entitlement,
      requestedAmount: input.requestedAmount,
    });
    return apiSuccess({ result }, { requestId });
  });
}
