import type { EmailProviderAdapter } from "@/lib/email/providers/types";
import { baseAdapter } from "@/lib/email/providers/base-adapter";

export function createSesAdapter(): EmailProviderAdapter {
  return baseAdapter("AMAZON_SES", {
    spfRecord: "include:amazonses.com",
    dkimSelector: "ses",
    webhookHeader: "x-amz-sns-message-type",
  });
}
