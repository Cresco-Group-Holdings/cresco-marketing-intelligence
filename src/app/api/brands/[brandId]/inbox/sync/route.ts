import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withInboxRead } from "@/lib/api/inbox-handler";
import { inboxSyncSchema } from "@/lib/validation/inbox";
import { socialInboxSyncService } from "@/server/services/social-inbox-sync-service";

type Params = { params: Promise<{ brandId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(inboxSyncSchema, await jsonBody(request));

  return withInboxRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        sync: await socialInboxSyncService.enqueue(
          brandId,
          organisationId,
          {
            ...body,
            scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
          },
          tenant!,
        ),
      },
      { requestId },
    ),
  );
}
