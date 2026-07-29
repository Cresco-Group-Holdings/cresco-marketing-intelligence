import type { SafeEmailPayload } from "@/lib/notifications/email-security";

export type EmailSendResult = {
  status: "SENT" | "SKIPPED" | "FAILED";
  externalId?: string;
  errorMessage?: string;
};

export interface EmailProvider {
  send(input: SafeEmailPayload & { to: string }): Promise<EmailSendResult>;
}

/** Development/test email provider — logs only, never sends secrets. */
class ConsoleEmailProvider implements EmailProvider {
  async send(input: SafeEmailPayload & { to: string }): Promise<EmailSendResult> {
    if (process.env.NODE_ENV === "production" && !process.env.EMAIL_PROVIDER_ENABLED) {
      return {
        status: "SKIPPED",
        errorMessage: "Email provider is not configured.",
      };
    }
    return {
      status: "SENT",
      externalId: `console-email-${Date.now()}`,
    };
  }
}

let provider: EmailProvider = new ConsoleEmailProvider();

export function getEmailProvider(): EmailProvider {
  return provider;
}

export function registerEmailProvider(next: EmailProvider): void {
  provider = next;
}
