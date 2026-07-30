import type { EmailMessageCategory, EmailProviderType } from "@prisma/client";

export const EMAIL_PROVIDER_TYPES: EmailProviderType[] = [
  "AMAZON_SES",
  "SENDGRID",
  "MAILGUN",
  "POSTMARK",
  "RESEND",
  "CUSTOM_SMTP",
];

export const EMAIL_MESSAGE_CATEGORIES: EmailMessageCategory[] = [
  "ESSENTIAL_TRANSACTIONAL",
  "ACCOUNT",
  "SERVICE_OPERATIONAL",
  "SALES_ONE_TO_ONE",
  "MARKETING",
  "NURTURE",
  "NEWSLETTER",
  "EVENT",
  "CUSTOMER_SUCCESS",
  "OTHER",
];

export const MARKETING_CATEGORIES: EmailMessageCategory[] = [
  "MARKETING",
  "NURTURE",
  "NEWSLETTER",
  "EVENT",
];

export const TRANSACTIONAL_CATEGORIES: EmailMessageCategory[] = [
  "ESSENTIAL_TRANSACTIONAL",
  "ACCOUNT",
  "SERVICE_OPERATIONAL",
];

export const DEFAULT_RETRY_ATTEMPTS = 3;
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;
export const DEFAULT_DAILY_QUOTA = 10_000;

export const DELIVERABILITY_THRESHOLDS = {
  bounceRateWarning: 0.05,
  bounceRateShutdown: 0.1,
  hardBounceRateWarning: 0.02,
  complaintRateWarning: 0.001,
  complaintRateShutdown: 0.003,
  unsubscribeRateWarning: 0.02,
} as const;
