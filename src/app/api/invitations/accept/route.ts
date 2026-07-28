import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody, withApiHandler } from "@/lib/api/handler";
import { invitationAcceptSchema } from "@/lib/validation/workspace";
import { invitationService } from "@/server/services";

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request, requestId, user }) => {
    const body = parseBody(invitationAcceptSchema, await jsonBody(request));
    const membership = await invitationService.accept(
      body.token,
      user.userProfileId,
      user.email,
      requestId,
    );
    return apiSuccess({ membership }, { requestId });
  });
}
