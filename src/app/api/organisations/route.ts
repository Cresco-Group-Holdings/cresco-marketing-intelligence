import { NextRequest } from "next/server";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  withApiHandler,
} from "@/lib/api/handler";
import { organisationCreateSchema } from "@/lib/validation/workspace";
import { organisationService } from "@/server/services";

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ requestId, user }) => {
    const organisations = await organisationService.listForUser(user.userProfileId);
    return apiSuccess({ organisations }, { requestId });
  });
}

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request, requestId, user }) => {
    const body = parseBody(organisationCreateSchema, await jsonBody(request));
    const organisation = await organisationService.create(body, user.userProfileId, requestId);
    return apiSuccess({ organisation }, { requestId });
  });
}
