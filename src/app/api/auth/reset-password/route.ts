import { NextRequest } from "next/server";
import {
  withPublicAuthHandler,
  apiSuccess,
  requireJsonContentType,
} from "@/lib/api/public-auth-handler";
import { parseBody, jsonBody } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { authService } from "@/server/services/auth-service";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { ensureUserProfile } from "@/lib/auth/provisioning";

export async function POST(request: NextRequest) {
  return withPublicAuthHandler(
    request,
    async ({ request, requestId, ipAddress }) => {
      requireJsonContentType(request);
      const body = parseBody(resetPasswordSchema, await jsonBody(request));

      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        throw new AppError(
          "UNAUTHORIZED",
          "Your reset link has expired. Request a new password reset email.",
        );
      }

      const { error } = await authService.updatePassword(body.password);
      if (error) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Unable to reset password. Request a new reset email and try again.",
        );
      }

      const provisioned = await ensureUserProfile({
        authUserId: user.id,
        email: user.email,
      });

      await authService.recordPasswordChanged(provisioned.userProfileId, {
        requestId,
        ipAddress,
      });

      return apiSuccess(
        {
          redirectTo: "/login?reset=success",
        },
        { requestId },
      );
    },
    { rateLimitAction: "reset-password" },
  );
}
