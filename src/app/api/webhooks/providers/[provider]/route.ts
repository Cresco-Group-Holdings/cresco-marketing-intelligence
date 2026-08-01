import { NextRequest, NextResponse } from "next/server";
import { providerWebhookService } from "@/server/services/provider-webhook-service";
import { RESEND_WEBHOOK_HEADERS } from "@/server/providers/resend/resend-webhook";

type Params = { params: Promise<{ provider: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { provider } = await params;
  const rawBody = await request.text();

  const result = await providerWebhookService.ingestWebhook({
    providerKey: provider,
    rawBody,
    headers: Object.fromEntries(request.headers.entries()),
    signature:
      request.headers.get(RESEND_WEBHOOK_HEADERS.signature) ??
      request.headers.get("svix-signature") ??
      request.headers.get("x-signature") ??
      undefined,
    timestamp:
      request.headers.get(RESEND_WEBHOOK_HEADERS.timestamp) ??
      request.headers.get("svix-timestamp") ??
      request.headers.get("x-timestamp") ??
      undefined,
  });

  return NextResponse.json(
    { message: result.message, eventId: "eventId" in result ? result.eventId : undefined },
    { status: result.status },
  );
}
