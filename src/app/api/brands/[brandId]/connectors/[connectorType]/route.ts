import { ConnectorType } from "@prisma/client";
import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withConnectorsRead,
} from "@/lib/api/connectors-handler";
import { AppError } from "@/lib/errors";
import { connectorService } from "@/server/services/connector-service";

type Params = { params: Promise<{ brandId: string; connectorType: string }> };

function parseConnectorType(value: string): ConnectorType {
  if (!(value in ConnectorType)) {
    throw new AppError("VALIDATION_ERROR", "Invalid connector type.");
  }
  return value as ConnectorType;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, connectorType } = await params;
  const organisationId = requireOrganisationId(request);

  return withConnectorsRead(request, organisationId, async ({ requestId, tenant }) => {
    const detail = await connectorService.getConnectorDetail(
      brandId,
      organisationId,
      parseConnectorType(connectorType),
      tenant!,
    );
    return apiSuccess({ connector: detail }, { requestId });
  });
}
