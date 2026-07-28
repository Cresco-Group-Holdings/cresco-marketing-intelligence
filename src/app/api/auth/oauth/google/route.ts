import { NextRequest } from "next/server";
import {
  withPublicAuthHandler,
  apiSuccess,
  requireJsonContentType,
} from "@/lib/api/public-auth-handler";
import { parseBody, jsonBody } from "@/lib/api/handler";
import { oauthProviderSchema } from "@/lib/validation/auth";
import { authService } from "@/server/services/auth-service";

export async function POST(request: NextRequest) {
  return withPublicAuthHandler(
    request,
    async ({ request, requestId, ipAddress }) => {
      requireJsonContentType(request);
      const body = parseBody(oauthProviderSchema, await jsonBody(request));

      const url = await authService.getOAuthSignInUrl(body.provider, body.redirect);

      return apiSuccess({ url }, { requestId, ipAddress });
    },
    { rateLimitAction: "oauth" },
  );
}
