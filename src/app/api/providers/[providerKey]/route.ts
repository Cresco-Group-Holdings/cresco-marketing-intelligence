import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import { requireOrganisationId } from "@/lib/api/integration-handler";
import { withProviderConnectionsRead } from "@/lib/api/providers-handler";
import { integrationConnectionService } from "@/server/services/integration-connection-service";
import { listProviderCapabilities } from "@/lib/providers/capability-registry";

type Params = { params: Promise<{ providerKey: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { providerKey } = await params;
  const organisationId = requireOrganisationId(request);
  const view = request.nextUrl.searchParams.get("view");

  if (view === "capabilities") {
    return withProviderConnectionsRead(request, organisationId, async ({ requestId }) => {
      return apiSuccess({ capabilities: listProviderCapabilities(providerKey) }, { requestId });
    });
  }

  return withProviderConnectionsRead(request, organisationId, async ({ requestId }) => {
    try {
      const provider = integrationConnectionService.getProvider(providerKey);
      return apiSuccess({ provider }, { requestId });
    } catch {
      throw new AppError("NOT_FOUND", "Provider not found.");
    }
  });
}
