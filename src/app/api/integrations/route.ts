import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import {
  requireOrganisationId,
  withIntegrationCreate,
  withIntegrationRead,
} from "@/lib/api/integration-handler";
import { integrationConnectionService } from "@/server/services/integration-connection-service";

export async function GET(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  return withIntegrationRead(request, organisationId, async ({ requestId, tenant }) => {
    const connections = await integrationConnectionService.listConnections(tenant!, {
      brandId: request.nextUrl.searchParams.get("brandId") ?? undefined,
    });
    return apiSuccess({ connections }, { requestId });
  });
}

export async function POST(request: NextRequest) {
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withIntegrationCreate(request, organisationId, async ({ requestId, tenant }) => {
    const connection = await integrationConnectionService.createConnection(tenant!, {
      providerKey: body.providerKey,
      name: body.name,
      brandId: body.brandId,
      projectId: body.projectId,
      apiKey: body.apiKey,
    });
    return apiSuccess({ connection }, { requestId });
  });
}
