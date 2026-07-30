import type { EmailMessageStatus } from "@prisma/client";
import { DEFAULT_RETRY_ATTEMPTS } from "@/lib/email/constants";

export type SendPipelineState = {
  status: EmailMessageStatus;
  retryCount: number;
  scheduledAt: Date | null;
  cancelledAt: Date | null;
};

export function canDispatch(state: SendPipelineState, now = new Date()): boolean {
  if (state.cancelledAt) return false;
  if (state.status === "SUPPRESSED" || state.status === "CANCELLED" || state.status === "DELIVERED") return false;
  if (state.status === "FAILED" && state.retryCount >= DEFAULT_RETRY_ATTEMPTS) return false;
  if (state.scheduledAt && state.scheduledAt > now) return false;
  return state.status === "QUEUED" || state.status === "SCHEDULED" || state.status === "FAILED";
}

export function nextStatusAfterDispatch(success: boolean, retryCount: number): EmailMessageStatus {
  if (success) return "SENT";
  return retryCount + 1 >= DEFAULT_RETRY_ATTEMPTS ? "FAILED" : "QUEUED";
}

export function canCancel(state: SendPipelineState): boolean {
  return ["QUEUED", "SCHEDULED"].includes(state.status) && !state.cancelledAt;
}

export function checkTenantQuota(sentToday: number, dailyQuota: number): { allowed: boolean; reason?: string } {
  if (sentToday >= dailyQuota) {
    return { allowed: false, reason: `Daily quota of ${dailyQuota} messages exceeded.` };
  }
  return { allowed: true };
}
