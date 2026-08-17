import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withIntegrationsWrite,
} from "@/lib/api/integrations-handler";
import { selectAccountsSchema } from "@/lib/validation/integrations";
import { integrationsConnectionService } from "@/server/services/integrations-connection-service";

type Params = { params: Promise<{ connectionId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { connectionId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  return withIntegrationsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(selectAccountsSchema, body);
    const accounts = await integrationsConnectionService.selectAccounts(
      tenant!,
      connectionId,
      input.externalAccountIds,
    );
    return apiSuccess({ accounts }, { requestId });
  });
}
