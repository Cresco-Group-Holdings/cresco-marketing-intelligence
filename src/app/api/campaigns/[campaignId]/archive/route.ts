import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { z } from "zod";
import {
  requireOrganisationId,
  withCampaignArchive,
} from "@/lib/api/campaigns-handler";
import { campaignService } from "@/server/services/campaign-service";

const archiveSchema = z.object({
  version: z.number().int().positive(),
});

type Params = { params: Promise<{ campaignId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { campaignId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(archiveSchema, await jsonBody(request));

  return withCampaignArchive(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        campaign: await campaignService.archive(
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
