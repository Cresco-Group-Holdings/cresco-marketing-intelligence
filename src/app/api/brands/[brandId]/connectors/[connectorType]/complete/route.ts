import { ConnectorType } from "@prisma/client";
import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withConnectorsWrite,
} from "@/lib/api/connectors-handler";
import { AppError } from "@/lib/errors";
import { completeConnectorOAuthSchema } from "@/lib/validation/connectors";
import { connectorService } from "@/server/services/connector-service";

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
  const body = parseBody(completeConnectorOAuthSchema, await jsonBody(request));

  if (body.connectorType !== connectorType) {
    throw new AppError("VALIDATION_ERROR", "Connector type mismatch.");
  }

  return withConnectorsWrite(request, organisationId, async ({ requestId, tenant }) => {
    const account = await connectorService.completeConnect(
      brandId,
      organisationId,
      connectorType,
      { state: body.state, code: body.code },
      tenant!,
      requestId,
    );
    return apiSuccess({ account }, { requestId });
  });
}
