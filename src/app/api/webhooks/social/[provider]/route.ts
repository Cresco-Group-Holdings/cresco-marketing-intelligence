import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { SocialProvider } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { apiSuccess } from "@/lib/api/handler";
import { createRequestId, handleApiError } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import { digestSecret, validateHmacSha256Signature } from "@/lib/inbox/webhook";
import {
  parseSocialInboxWebhookPayload,
  providerFromPathSegment,
} from "@/lib/inbox/webhook-payload";
import { validateMetaWebhookSignature } from "@/lib/social/inbox-webhook";
import { socialInboxWebhookService } from "@/server/services/social-inbox-webhook-service";

type Params = { params: Promise<{ provider: string }> };

function resolveProvider(segment: string): SocialProvider {
  const provider = providerFromPathSegment(segment);
  if (!provider) {
    throw new AppError("VALIDATION_ERROR", "Unsupported social provider.");
  }
  return provider;
}

function requireQueryParam(request: NextRequest, key: string): string {
  const value = request.nextUrl.searchParams.get(key)?.trim();
  if (!value) {
    throw new AppError("VALIDATION_ERROR", `${key} query parameter is required.`);
  }
  return value;
}

async function loadSubscription(socialAccountId: string, provider: SocialProvider) {
  const subscription = await prisma.socialInboxWebhookSubscription.findUnique({
    where: { socialAccountId },
  });
  if (!subscription || subscription.status !== "ACTIVE" || subscription.provider !== provider) {
    throw new AppError("NOT_FOUND", "Webhook subscription was not found.");
  }
  return subscription;
}

export async function GET(request: NextRequest, { params }: Params) {
  const requestId = createRequestId();
  try {
    const { provider: providerSegment } = await params;
    const provider = resolveProvider(providerSegment);
    const socialAccountId = requireQueryParam(request, "socialAccountId");
    const subscription = await loadSubscription(socialAccountId, provider);

    const hubMode = request.nextUrl.searchParams.get("hub.mode");
    const hubVerifyToken = request.nextUrl.searchParams.get("hub.verify_token");
    const hubChallenge = request.nextUrl.searchParams.get("hub.challenge");
    if (hubMode === "subscribe" && hubVerifyToken && hubChallenge) {
      if (digestSecret(hubVerifyToken) !== subscription.verifyTokenDigest) {
        throw new AppError("FORBIDDEN", "Webhook verify token mismatch.");
      }
      return new NextResponse(hubChallenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const crcToken = request.nextUrl.searchParams.get("crc_token");
    if (crcToken) {
      const consumerSecret = process.env.X_CONSUMER_SECRET ?? process.env.SOCIAL_INBOX_WEBHOOK_SECRET;
      if (!consumerSecret) {
        throw new AppError("VALIDATION_ERROR", "X webhook consumer secret is not configured.");
      }
      const responseToken = createHmac("sha256", consumerSecret).update(crcToken).digest("base64");
      return NextResponse.json({ response_token: `sha256=${responseToken}` });
    }

    throw new AppError("VALIDATION_ERROR", "Unsupported webhook verification request.");
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = createRequestId();
  try {
    const { provider: providerSegment } = await params;
    const provider = resolveProvider(providerSegment);
    const socialAccountId = requireQueryParam(request, "socialAccountId");
    const organisationId = requireQueryParam(request, "organisationId");
    const brandId = requireQueryParam(request, "brandId");
    const subscription = await loadSubscription(socialAccountId, provider);

    const payload = await request.text();
    const signatureHeader =
      request.headers.get("x-hub-signature-256") ??
      request.headers.get("x-twitter-webhooks-signature");

    let secret: string | null = null;
    if (["INSTAGRAM", "FACEBOOK"].includes(provider)) {
      secret = process.env.META_APP_SECRET ?? process.env.SOCIAL_INBOX_WEBHOOK_SECRET ?? null;
      if (secret && signatureHeader) {
        const validation = validateMetaWebhookSignature({
          rawBody: payload,
          signatureHeader,
          appSecret: secret,
        });
        if (!validation.valid) {
          throw new AppError("FORBIDDEN", validation.reason);
        }
      }
    } else if (provider === "X") {
      secret = process.env.X_CONSUMER_SECRET ?? process.env.SOCIAL_INBOX_WEBHOOK_SECRET ?? null;
    }

    const idempotencyKey =
      request.headers.get("x-idempotency-key") ??
      `${provider}:${socialAccountId}:${digestSecret(payload).slice(0, 32)}`;

    const result = await socialInboxWebhookService.ingestEvent({
      socialAccountId,
      organisationId,
      brandId,
      provider,
      idempotencyKey,
      payload,
      signatureHeader,
      secret,
      toBatch: (rawPayload) => parseSocialInboxWebhookPayload(provider, rawPayload),
    });

    if (
      secret &&
      signatureHeader &&
      !["INSTAGRAM", "FACEBOOK"].includes(provider) &&
      !validateHmacSha256Signature({ payload, signatureHeader, secret })
    ) {
      throw new AppError("FORBIDDEN", "Webhook signature validation failed.");
    }

    return apiSuccess(result, { requestId });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
