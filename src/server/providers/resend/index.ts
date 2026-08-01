export { createResendAdapter, parseResendWebhookBody } from "@/server/providers/resend/resend-adapter";
export type { ResendAdapterBundle } from "@/server/providers/resend/resend-adapter";
export { createResendClient, ResendClientError } from "@/server/providers/resend/resend-client";
export { listResendVerifiedDomains, isDomainSendingEligible, buildDnsGuidance } from "@/server/providers/resend/resend-domain-service";
export { mapResendSafeErrorCode } from "@/server/providers/resend/resend-errors";
export {
  normalizeResendWebhookEvent,
  mapNormalizedEventToEmailStatus,
  shouldAdvanceEmailStatus,
} from "@/server/providers/resend/resend-normalizer";
export {
  verifyResendWebhookSignature,
  extractResendWebhookEventId,
  RESEND_WEBHOOK_HEADERS,
} from "@/server/providers/resend/resend-webhook";
export type { ResendWebhookPayload } from "@/server/providers/resend/resend-types";
