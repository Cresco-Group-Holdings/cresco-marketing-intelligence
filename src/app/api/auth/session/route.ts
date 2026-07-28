import { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { authService } from "@/server/services/auth-service";
import { assertSameOrigin } from "@/lib/security/csrf";
import { getClientIpAddress } from "@/lib/auth/request";

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ user, requestId }) => {
    const { user: authUser, session, identities } = await authService.getCurrentSession();

    return apiSuccess(
      {
        authenticated: Boolean(authUser),
        emailVerified: Boolean(authUser?.email_confirmed_at),
        session: session
          ? {
              expiresAt: session.expires_at,
              expiresIn: session.expires_in,
            }
          : null,
        identities,
        user: authUser
          ? {
              id: user.userProfileId,
              email: user.email,
            }
          : null,
      },
      { requestId },
    );
  });
}

export async function DELETE(request: NextRequest) {
  return withApiHandler(request, async ({ user, requestId }) => {
    assertSameOrigin(request);
    const ipAddress = getClientIpAddress(request);

    await authService.revokeAllSessions(user.userId);
    await authService.signOut("local");
    await authService.recordSessionRevoked(user.userProfileId, { requestId, ipAddress }, "global");

    return apiSuccess({ revoked: true }, { requestId });
  });
}
