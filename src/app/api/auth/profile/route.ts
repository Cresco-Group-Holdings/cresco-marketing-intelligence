import { NextRequest } from "next/server";
import { parseBody, withApiHandler, jsonBody } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { prisma } from "@/lib/database/prisma";
import { updateProfileSchema } from "@/lib/validation/auth";
import { assertSameOrigin } from "@/lib/security/csrf";

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ user }) => {
    const profile = await prisma.userProfile.findUniqueOrThrow({
      where: { id: user.userProfileId },
    });

    return apiSuccess({
      profile: {
        id: profile.id,
        email: profile.email,
        displayName: profile.displayName,
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatarUrl: profile.avatarUrl,
        timezone: profile.timezone,
        locale: profile.locale,
      },
    });
  });
}

export async function PATCH(request: NextRequest) {
  return withApiHandler(request, async ({ user, requestId }) => {
    assertSameOrigin(request);
    const body = parseBody(updateProfileSchema, await jsonBody(request));

    const profile = await prisma.userProfile.update({
      where: { id: user.userProfileId },
      data: {
        displayName: body.displayName ?? undefined,
        firstName: body.firstName ?? undefined,
        lastName: body.lastName ?? undefined,
        avatarUrl: body.avatarUrl === "" ? null : (body.avatarUrl ?? undefined),
        timezone: body.timezone ?? undefined,
        locale: body.locale ?? undefined,
      },
    });

    return apiSuccess(
      {
        profile: {
          id: profile.id,
          email: profile.email,
          displayName: profile.displayName,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
          timezone: profile.timezone,
          locale: profile.locale,
        },
      },
      { requestId },
    );
  });
}
