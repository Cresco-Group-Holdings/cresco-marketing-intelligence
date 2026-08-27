import { NextRequest } from "next/server";
import { z } from "zod";
import { BrandMarketingChannel } from "@prisma/client";
import { apiSuccess, jsonBody, parseBody, withApiHandler } from "@/lib/api/handler";
import { activationService } from "@/server/services/activation-service";
import type { ActivationGoal } from "@/lib/activation/providers";

const preferencesSchema = z.object({
  goal: z
    .enum([
      "grow_organic_reach",
      "create_better_content",
      "understand_performance",
      "improve_paid_advertising",
      "track_conversions",
      "manage_in_one_place",
    ])
    .nullable()
    .optional(),
  persona: z.string().trim().max(64).nullable().optional(),
  channels: z.array(z.nativeEnum(BrandMarketingChannel)).optional(),
});

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request, requestId, user }) => {
    const body = parseBody(preferencesSchema, await jsonBody(request));
    await activationService.savePreferences(
      user.userProfileId,
      {
        goal: (body.goal ?? undefined) as ActivationGoal | undefined,
        persona: body.persona ?? undefined,
        channels: body.channels,
      },
      requestId,
    );
    const activation = await activationService.getState(user.userProfileId);
    return apiSuccess({ activation }, { requestId });
  });
}
