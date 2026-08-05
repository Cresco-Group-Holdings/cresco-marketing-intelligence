import { NextRequest } from "next/server";
import { apiSuccess, parseBody } from "@/lib/api/handler";
import { withPlatformAdmin } from "@/lib/api/admin-handler";
import { dataDeletionRequestSchema } from "@/lib/validation/admin";
import { dataDeletionService } from "@/server/services/data-deletion-service";

export async function GET(request: NextRequest) {
  return withPlatformAdmin(request, async ({ requestId }) => {
    const organisationId = request.nextUrl.searchParams.get("organisationId") ?? undefined;
    const requests = await dataDeletionService.listRequests({ organisationId });
    return apiSuccess({ requests }, { requestId });
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  return withPlatformAdmin(request, async ({ requestId, user }) => {
    const input = parseBody(dataDeletionRequestSchema, body);
    const deletionRequest = await dataDeletionService.createRequest({
      ...input,
      requestedById: user.userProfileId,
      requestId,
    });
    return apiSuccess({ request: deletionRequest }, { requestId });
  });
}
