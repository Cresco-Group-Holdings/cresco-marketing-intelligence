import type { EmailCampaignStatus } from "@prisma/client";

export function canScheduleCampaign(status: EmailCampaignStatus, emergencyStopped: boolean): boolean {
  if (emergencyStopped) return false;
  return status === "APPROVED" || status === "READY_FOR_REVIEW";
}

export function canCancelSchedule(status: EmailCampaignStatus): boolean {
  return ["SCHEDULED", "APPROVED"].includes(status);
}

export function canEmergencyStop(status: EmailCampaignStatus): boolean {
  return ["SCHEDULED", "SENDING"].includes(status);
}

export function resolveStatusAfterSend(attempted: number, sent: number, failed: number): EmailCampaignStatus {
  if (sent === 0 && failed > 0) return "FAILED";
  if (failed > 0 && sent > 0) return "PARTIALLY_SENT";
  if (sent > 0 && sent >= attempted) return "SENT";
  return "SENDING";
}

export function isScheduleDue(scheduledAt: Date | null, sendNow: boolean, now = new Date()): boolean {
  if (sendNow) return true;
  if (!scheduledAt) return false;
  return scheduledAt <= now;
}
