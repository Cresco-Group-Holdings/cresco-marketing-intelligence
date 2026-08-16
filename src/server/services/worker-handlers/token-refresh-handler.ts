import { tokenLifecycleService } from "@/server/services/token-lifecycle-service";
import type { WorkerHandler } from "@/lib/workers/types";
import { prisma } from "@/lib/database/prisma";

export const tokenRefreshWorkerHandler: WorkerHandler = async (input) => {
  if (input.domainRefType !== "providerConnection") {
    return { outcome: "failed", errorCategory: "CONFIGURATION_ERROR", safeMessage: "Invalid domain reference." };
  }

  const connection = await prisma.providerConnection.findFirst({
    where: { id: input.domainRefId, organisationId: input.organisationId },
    select: { id: true },
  });
  if (!connection) {
    return { outcome: "failed", errorCategory: "NON_RETRYABLE", safeMessage: "Connection tenant mismatch." };
  }

  const result = await tokenLifecycleService.refreshConnectionTokens(
    { organisationId: input.organisationId },
    connection.id,
  );

  if (result.status === "VALID" || result.status === "ACTIVE" || result.status === "EXPIRING") {
    return { outcome: "success" };
  }

  if (result.status === "REAUTH_REQUIRED") {
    return {
      outcome: "failed",
      errorCategory: "REAUTH_REQUIRED",
      safeMessage: "Provider connection requires reauthorization.",
    };
  }

  return {
    outcome: "retry",
    errorCategory: "RETRYABLE",
    safeMessage: "Token refresh failed.",
  };
};
