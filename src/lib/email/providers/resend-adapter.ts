import type { EmailProviderAdapter } from "@/lib/email/providers/types";
import { baseAdapter } from "@/lib/email/providers/base-adapter";

export function createResendAdapter(): EmailProviderAdapter {
  return baseAdapter("RESEND", {
    spfRecord: "include:resend.com",
    dkimSelector: "resend",
    webhookHeader: "resend-signature",
  });
}
