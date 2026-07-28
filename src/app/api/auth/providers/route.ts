import { NextRequest } from "next/server";
import {
  withPublicAuthHandler,
  apiSuccess,
  requireJsonContentType,
} from "@/lib/api/public-auth-handler";
import { parseBody, jsonBody } from "@/lib/api/handler";
import { oauthProviderSchema } from "@/lib/validation/auth";
import { authService } from "@/server/services/auth-service";
import { getEnabledOAuthProviders } from "@/lib/auth/providers";

export async function GET() {
  return apiSuccess({
    providers: getEnabledOAuthProviders().map((provider) => ({
      id: provider.id,
      label: provider.label,
    })),
  });
}

export async function POST(request: NextRequest) {
  return withPublicAuthHandler(
    request,
    async ({ request, requestId }) => {
      requireJsonContentType(request);
      const body = parseBody(oauthProviderSchema, await jsonBody(request));
      const url = await authService.getOAuthSignInUrl(body.provider, body.redirect);

      return apiSuccess({ url }, { requestId });
    },
    { rateLimitAction: "oauth" },
  );
}
