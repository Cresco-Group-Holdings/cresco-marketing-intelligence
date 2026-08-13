import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { z } from "zod";
import {
  requireOrganisationId,
  withCampaignRestore,
} from "@/lib/api/campaigns-handler";
import { campaignService } from "@/server/services/campaign-service";

const restoreSchema = z.object({
  version: z.number().int().positive(),
});

type Params = { params: Promise<{ campaignId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { campaignId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(restoreSchema, await jsonBody(request));

  return withCampaignRestore(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        campaign: await campaignService.restore(
          campaignId,
          organisationId,
          body.version,
          tenant!,
          requestId,
        ),
      },
      { requestId },
    ),
  );
}
