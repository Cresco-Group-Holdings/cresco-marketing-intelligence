import type { EmailProviderType } from "@prisma/client";
import type { EmailProviderAdapter } from "@/lib/email/providers/types";
import { createSesAdapter } from "@/lib/email/providers/ses-adapter";
import { createSendGridAdapter } from "@/lib/email/providers/sendgrid-adapter";
import { createMailgunAdapter } from "@/lib/email/providers/mailgun-adapter";
import { createPostmarkAdapter } from "@/lib/email/providers/postmark-adapter";
import { createResendAdapter } from "@/lib/email/providers/resend-adapter";
import { createCustomSmtpAdapter } from "@/lib/email/providers/custom-smtp-adapter";

const factories: Record<EmailProviderType, () => EmailProviderAdapter> = {
  AMAZON_SES: createSesAdapter,
  SENDGRID: createSendGridAdapter,
  MAILGUN: createMailgunAdapter,
  POSTMARK: createPostmarkAdapter,
  RESEND: createResendAdapter,
  CUSTOM_SMTP: createCustomSmtpAdapter,
};

export function getEmailProviderAdapter(providerType: EmailProviderType): EmailProviderAdapter {
  return factories[providerType]();
}
