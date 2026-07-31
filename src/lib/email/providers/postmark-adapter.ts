import type { EmailProviderAdapter } from "@/lib/email/providers/types";
import { baseAdapter } from "@/lib/email/providers/base-adapter";

export function createPostmarkAdapter(): EmailProviderAdapter {
  return baseAdapter("POSTMARK", {
    spfRecord: "include:spf.mtasv.net",
    dkimSelector: "pm",
    webhookHeader: "x-postmark-signature",
  });
}
