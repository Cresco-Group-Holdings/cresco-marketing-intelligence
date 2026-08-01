import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withProviderConnectionsWrite,
} from "@/lib/api/providers-handler";
import { providerResendConnectionService } from "@/server/services/provider-resend-connection-service";

export async function POST(request: NextRequest) {
  const organisationId = requireOrganisationId(request);

  return withProviderConnectionsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const body = (await request.json()) as {
      displayName: string;
      apiKey: string;
      environment?: "SANDBOX" | "PRODUCTION";
      brandId?: string;
      projectId?: string;
      defaultSendingDomain?: string;
      defaultSenderIdentity?: string;
    };

    const result = await providerResendConnectionService.connectWithApiKey(tenant!, {
      displayName: body.displayName,
      apiKey: body.apiKey,
      environment: body.environment,
      brandId: body.brandId,
      projectId: body.projectId,
      defaultSendingDomain: body.defaultSendingDomain,
      defaultSenderIdentity: body.defaultSenderIdentity,
    });

    return apiSuccess({ connection: result }, { requestId });
  });
}
