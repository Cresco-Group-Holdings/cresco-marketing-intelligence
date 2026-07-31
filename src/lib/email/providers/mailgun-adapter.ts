import type { EmailProviderAdapter } from "@/lib/email/providers/types";
import { baseAdapter } from "@/lib/email/providers/base-adapter";

export function createMailgunAdapter(): EmailProviderAdapter {
  return baseAdapter("MAILGUN", {
    spfRecord: "include:mailgun.org",
    dkimSelector: "mg",
    webhookHeader: "x-mailgun-signature",
  });
}
