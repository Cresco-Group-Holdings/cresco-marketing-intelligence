import { prisma } from "@/lib/database/prisma";
import { seoCrawlService } from "@/server/services/seo-crawl-service";
import type { WorkerHandler } from "@/lib/workers/types";

export const seoCrawlWorkerHandler: WorkerHandler = async (input, context) => {
  const run = await prisma.seoCrawlRun.findFirst({
    where: { id: input.domainRefId, organisationId: input.organisationId },
    select: { id: true },
  });
  if (!run) {
    return { outcome: "failed", errorCategory: "NON_RETRYABLE", safeMessage: "SEO crawl tenant mismatch." };
  }

  const result = await seoCrawlService.process(run.id, context.workerId);
  if (result.status === "SKIPPED") {
    return { outcome: "skipped", reason: "SEO crawl not claimable." };
  }

  if (result.status === "COMPLETED") {
    return { outcome: "success" };
  }

  if (result.status === "FAILED") {
    return {
      outcome: "retry",
      errorCategory: "RETRYABLE",
      safeMessage: "SEO crawl failed.",
    };
  }

  return { outcome: "success" };
};
