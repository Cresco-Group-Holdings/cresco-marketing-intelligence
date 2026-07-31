import type { EmailProviderAdapter } from "@/lib/email/providers/types";
import { baseAdapter } from "@/lib/email/providers/base-adapter";

export function createCustomSmtpAdapter(): EmailProviderAdapter {
  return baseAdapter("CUSTOM_SMTP", {
    spfRecord: "configured-by-customer",
    dkimSelector: "custom",
    webhookHeader: "x-custom-smtp-signature",
  });
}
