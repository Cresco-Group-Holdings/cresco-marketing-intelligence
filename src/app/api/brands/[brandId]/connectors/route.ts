import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withConnectorsRead,
} from "@/lib/api/connectors-handler";
import { connectorService } from "@/server/services/connector-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);

  return withConnectorsRead(request, organisationId, async ({ requestId, tenant }) => {
    const catalogue = await connectorService.getCatalogue(brandId, organisationId, tenant!);
    return apiSuccess({ catalogue }, { requestId });
  });
}
