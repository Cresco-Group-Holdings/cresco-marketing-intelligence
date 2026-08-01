import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withProviderConnectionsRead,
  withProviderConnectionsWrite,
} from "@/lib/api/providers-handler";
import { providerConnectionService } from "@/server/services/provider-connection-service";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const brandId = request.nextUrl.searchParams.get("brandId") ?? undefined;
  const projectId = request.nextUrl.searchParams.get("projectId") ?? undefined;

  return withProviderConnectionsRead(request, organisationId, async ({ requestId, tenant }) => {
    const connections = await providerConnectionService.listConnections(tenant!, { brandId, projectId });
    return apiSuccess({ connections }, { requestId });
  });
}

export async function POST(request: NextRequest) {
  const organisationId = requireOrganisationId(request);

  return withProviderConnectionsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const body = (await request.json()) as {
      providerKey: string;
      displayName?: string;
      brandId?: string;
      projectId?: string;
      configuration?: Record<string, unknown>;
    };
    const connection = await providerConnectionService.createDraftConnection(tenant!, body);
    return apiSuccess({ connection }, { requestId });
  });
}
