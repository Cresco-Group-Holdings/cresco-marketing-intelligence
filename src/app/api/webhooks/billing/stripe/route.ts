import { NextRequest, NextResponse } from "next/server";
import { billingWebhookService } from "@/server/services/billing-webhook-service";

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  try {
    const result = await billingWebhookService.processStripeEvent(payload, signature);
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
