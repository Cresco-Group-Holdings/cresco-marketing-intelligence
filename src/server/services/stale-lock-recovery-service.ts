import { prisma } from "@/lib/database/prisma";

const STALE_LOCK_MINUTES = 30;

export const staleLockRecoveryService = {
  async recoverStalePublishingJobs() {
    const cutoff = new Date();
    cutoff.setMinutes(cutoff.getMinutes() - STALE_LOCK_MINUTES);

    const result = await prisma.publishingJob.updateMany({
      where: {
        status: "PROCESSING",
        updatedAt: { lt: cutoff },
      },
      data: {
        status: "QUEUED",
      },
    });

    return { recovered: result.count, cutoff: cutoff.toISOString() };
  },

  async recoverStaleOperationalAlerts() {
    const cutoff = new Date();
    cutoff.setMinutes(cutoff.getMinutes() - STALE_LOCK_MINUTES);

    const stale = await prisma.operationalAlert.findMany({
      where: {
        status: "OPEN",
        lastAttemptAt: { lt: cutoff },
        attemptCount: { gte: 1 },
      },
      take: 100,
    });

    return { staleCount: stale.length, alerts: stale.map((a) => a.id) };
  },
};
