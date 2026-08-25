import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, jsonBody, parseBody, withApiHandler } from "@/lib/api/handler";
import { ACTIVATION_EVENT_NAMES } from "@/lib/activation/events";
import { activationService } from "@/server/services/activation-service";

const eventSchema = z.object({
  event: z.enum(ACTIVATION_EVENT_NAMES),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request, requestId, user }) => {
    const body = parseBody(eventSchema, await jsonBody(request));
    await activationService.recordEvent(
      user.userProfileId,
      body.event,
      body.metadata,
      requestId,
    );
    return apiSuccess({ recorded: true }, { requestId });
  });
}
