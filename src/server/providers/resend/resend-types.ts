export type ResendDomainRecord = {
  id: string;
  name: string;
  status: string;
  region?: string;
  created_at?: string;
  records?: Array<{
    record: string;
    name: string;
    type: string;
    ttl?: string;
    status: string;
    value: string;
    priority?: number;
  }>;
};

export type ResendDomainListResponse = {
  data: ResendDomainRecord[];
};

export type ResendSendEmailPayload = {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  reply_to?: string | string[];
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
};

export type ResendSendEmailResponse = {
  id: string;
};

export type ResendApiErrorBody = {
  statusCode?: number;
  message?: string;
  name?: string;
};

export type ResendWebhookPayload = {
  type: string;
  created_at: string;
  data: Record<string, unknown>;
};

export const RESEND_API_BASE_URL = "https://api.resend.com";
export const RESEND_API_KEY_PATTERN = /^re_[A-Za-z0-9_]+$/;
export const RESEND_WEBHOOK_EVENT_TYPES = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.opened",
  "email.clicked",
  "email.suppressed",
  "domain.created",
  "domain.updated",
  "domain.deleted",
  "suppression.added",
  "suppression.removed",
] as const;
