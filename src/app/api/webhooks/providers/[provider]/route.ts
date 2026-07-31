import { NextRequest, NextResponse } from "next/server";
import { providerWebhookService } from "@/server/services/provider-webhook-service";

type Params = { params: Promise<{ provider: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { provider } = await params;
  const rawBody = await request.text();

  const result = await providerWebhookService.ingestWebhook({
    providerKey: provider,
    rawBody,
    headers: Object.fromEntries(request.headers.entries()),
    signature: request.headers.get("x-signature") ?? request.headers.get("x-hub-signature-256") ?? undefined,
    timestamp: request.headers.get("x-timestamp") ?? undefined,
  });

  return NextResponse.json({ message: result.message, eventId: "eventId" in result ? result.eventId : undefined }, {
    status: result.status,
  });
}
