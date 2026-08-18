import { notificationDigestService } from "@/server/services/notification-service";
import type { WorkerHandler } from "@/lib/workers/types";

export const notificationDigestWorkerHandler: WorkerHandler = async (input) => {
  const period = input.payload?.period;
  if (period !== "DIGEST_DAILY" && period !== "DIGEST_WEEKLY") {
    return { outcome: "failed", errorCategory: "CONFIGURATION_ERROR", safeMessage: "Invalid digest period." };
  }

  if (input.payload?.organisationId !== input.organisationId) {
    return { outcome: "failed", errorCategory: "NON_RETRYABLE", safeMessage: "Digest tenant mismatch." };
  }

  try {
    await notificationDigestService.processDue(period);
    return { outcome: "success" };
  } catch {
    return {
      outcome: "retry",
      errorCategory: "RETRYABLE",
      safeMessage: "Notification digest delivery failed.",
    };
  }
};
