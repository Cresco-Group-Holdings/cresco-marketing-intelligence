import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { requireOrganisationId, withBillingRead } from "@/lib/api/billing-handler";
import { subscriptionService } from "@/server/services/subscription-service";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);

  return withBillingRead(request, organisationId, async ({ requestId, tenant }) => {
    const invoices = await subscriptionService.listInvoices(tenant!.organisationId);
    return apiSuccess({ invoices }, { requestId });
  });
}
