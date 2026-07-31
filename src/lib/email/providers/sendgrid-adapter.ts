import type { EmailProviderAdapter } from "@/lib/email/providers/types";
import { baseAdapter } from "@/lib/email/providers/base-adapter";

export function createSendGridAdapter(): EmailProviderAdapter {
  return baseAdapter("SENDGRID", {
    spfRecord: "include:sendgrid.net",
    dkimSelector: "s1",
    webhookHeader: "x-twilio-email-event-webhook-signature",
  });
}
