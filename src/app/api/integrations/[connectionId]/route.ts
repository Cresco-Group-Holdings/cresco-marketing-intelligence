import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import {
  requireOrganisationId,
  withIntegrationDisconnect,
  withIntegrationRead,
  withIntegrationUpdate,
} from "@/lib/api/integration-handler";
import { integrationConnectionService } from "@/server/services/integration-connection-service";

type Params = { params: Promise<{ connectionId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { connectionId } = await params;
  const organisationId = requireOrganisationId(request);
  return withIntegrationRead(request, organisationId, async ({ requestId, tenant }) => {
    const connection = await integrationConnectionService.getConnection(tenant!, connectionId);
    return apiSuccess({ connection }, { requestId });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { connectionId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withIntegrationUpdate(request, organisationId, async ({ requestId, tenant }) => {
    // Name updates flow through provider connection service in future; acknowledge patch for now.
    const connection = await integrationConnectionService.getConnection(tenant!, connectionId);
    return apiSuccess({ connection, patch: body }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { connectionId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  if (body.action === "revoke") {
    return withIntegrationDisconnect(request, organisationId, async ({ requestId, tenant }) => {
      await integrationConnectionService.revokeConnection(tenant!, connectionId);
      return apiSuccess({ revoked: true }, { requestId });
    });
  }

  return withIntegrationUpdate(request, organisationId, async ({ requestId }) => {
    return apiSuccess({ connectionId, action: body.action ?? "noop" }, { requestId });
  });
}
