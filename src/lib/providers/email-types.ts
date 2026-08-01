export type EmailMessageType = "TRANSACTIONAL" | "MARKETING" | "TEST";

export type EmailSendRequest = {
  organisationId: string;
  brandId?: string;
  connectionId: string;
  messageType: EmailMessageType;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  tags?: Record<string, string>;
  campaignId?: string;
  recipientId?: string;
  idempotencyKey: string;
  approvalId?: string;
  metadata?: Record<string, unknown>;
};

export type EmailSendResult = {
  provider: string;
  connectionId: string;
  providerMessageId?: string;
  accepted: boolean;
  status: "ACCEPTED" | "SIMULATED" | "REJECTED" | "DUPLICATE" | "FAILED";
  requestId?: string;
  sentAt?: string;
  safeErrorCode?: string;
};

export type EmailBatchSendRequest = {
  organisationId: string;
  brandId?: string;
  connectionId: string;
  messageType: EmailMessageType;
  messages: Array<Omit<EmailSendRequest, "organisationId" | "brandId" | "connectionId" | "messageType">>;
  approvalId?: string;
};

export type VerifiedDomainInfo = {
  id: string;
  name: string;
  status: string;
  region?: string;
  sendingEligible: boolean;
  spfStatus?: string;
  dkimStatus?: string;
  verifiedAt?: string;
  lastCheckedAt: string;
};

export const EMAIL_SEND_MAX_RECIPIENTS = 50;
export const EMAIL_BATCH_MAX_SIZE = 100;
export const EMAIL_MAX_ATTACHMENT_BYTES = 40 * 1024 * 1024;
