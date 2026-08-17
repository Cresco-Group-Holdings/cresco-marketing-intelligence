import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import { requireOrganisationId, withContentPublish } from "@/lib/api/content-handler";
import { canonicalPublicationService } from "@/server/services/canonical-publication-service";

const publishBodySchema = z.object({
  contentItemId: z.string().min(1),
  contentVariantId: z.string().optional(),
  connectionId: z.string().min(1),
  externalAccountId: z.string().min(1),
  destinationType: z.string().default("account"),
  destinationId: z.string().optional(),
  operationType: z.enum(["SOCIAL_PUBLISH_POST", "SOCIAL_SCHEDULE_POST"]).default("SOCIAL_PUBLISH_POST"),
  scheduledFor: z.string().datetime().optional(),
  timezone: z.string().default("UTC"),
  idempotencyKey: z.string().min(8),
  providerPayload: z.record(z.string(), z.unknown()).optional(),
});

type Params = { params: Promise<{ brandId: string; contentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = parseBody(publishBodySchema, await jsonBody(request));

  return withContentPublish(request, organisationId, async ({ requestId, tenant }) => {
    const destinationId = body.destinationId ?? body.externalAccountId;

    if (body.scheduledFor) {
      const result = await canonicalPublicationService.schedulePublication(
        brandId,
        organisationId,
        {
          ...body,
          destinationId,
          operationType: "SOCIAL_SCHEDULE_POST",
          scheduledFor: body.scheduledFor,
        },
        tenant!,
        requestId,
      );
      return apiSuccess(result, { requestId });
    }

    const result = await canonicalPublicationService.publishNow(
      brandId,
      organisationId,
      {
        ...body,
        destinationId,
        operationType: "SOCIAL_PUBLISH_POST",
      },
      tenant!,
      requestId,
    );
    return apiSuccess(result, { requestId });
  });
}
