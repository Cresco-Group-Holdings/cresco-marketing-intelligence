import { ConnectorType } from "@prisma/client";
import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withConnectorsWrite,
} from "@/lib/api/connectors-handler";
import { AppError } from "@/lib/errors";
import { connectorSyncSchema } from "@/lib/validation/connectors";
import { prisma } from "@/lib/database/prisma";
import { connectorSyncService } from "@/server/services/connector-sync-service";

type Params = { params: Promise<{ brandId: string; connectorType: string }> };

function parseConnectorType(value: string): ConnectorType {
  if (!(value in ConnectorType)) {
    throw new AppError("VALIDATION_ERROR", "Invalid connector type.");
  }
  return value as ConnectorType;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, connectorType: connectorTypeParam } = await params;
  const organisationId = requireOrganisationId(request);
  const connectorType = parseConnectorType(connectorTypeParam);
  const body = parseBody(connectorSyncSchema, await jsonBody(request));

  return withConnectorsWrite(request, organisationId, async ({ requestId }) => {
    const account = await prisma.connectorAccount.findFirst({
      where: {
        organisationId,
        brandId,
        connectorType,
      },
    });
    if (!account) {
      throw new AppError("NOT_FOUND", "Connector account was not found.");
    }

    const sync = await connectorSyncService.startSync({
      organisationId,
      projectId: account.projectId,
      brandId,
      connectorAccountId: account.id,
      connectorType,
      syncType: body.syncType,
      idempotencyKey: body.idempotencyKey,
    });

    return apiSuccess({ sync }, { requestId });
  });
}
