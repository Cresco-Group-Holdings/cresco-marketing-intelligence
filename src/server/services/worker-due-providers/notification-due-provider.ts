import { prisma } from "@/lib/database/prisma";
import { notificationDigestJobIdempotencyKey } from "@/lib/workers/idempotency";
import type { DueWorkItem } from "@/lib/workers/types";

function digestWindowStart(now: Date, period: "DIGEST_DAILY" | "DIGEST_WEEKLY"): Date {
  const dayMs = 86_400_000;
  const windowMs = period === "DIGEST_WEEKLY" ? 7 * dayMs : dayMs;
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export async function discoverNotificationDueWork(now: Date, limit: number): Promise<DueWorkItem[]> {
  const pending = await prisma.notificationDelivery.findMany({
    where: {
      channel: { in: ["DIGEST_DAILY", "DIGEST_WEEKLY"] },
      status: "PENDING",
      digestId: null,
    },
    include: { notification: { select: { organisationId: true } } },
    take: limit,
  });

  const grouped = new Map<string, { organisationId: string; period: "DIGEST_DAILY" | "DIGEST_WEEKLY" }>();
  for (const delivery of pending) {
    const period = delivery.channel as "DIGEST_DAILY" | "DIGEST_WEEKLY";
    const key = `${delivery.notification.organisationId}:${period}`;
    if (!grouped.has(key)) {
      grouped.set(key, { organisationId: delivery.notification.organisationId, period });
    }
  }

  return [...grouped.values()].map((entry) => {
    const windowStart = digestWindowStart(now, entry.period);
    return {
      organisationId: entry.organisationId,
      jobType: "NOTIFICATION_DIGEST" as const,
      domainRefType: "notificationDigest",
      domainRefId: `${entry.organisationId}:${entry.period}`,
      idempotencyKey: notificationDigestJobIdempotencyKey(entry.organisationId, entry.period, windowStart),
      dueAt: now,
      payload: { organisationId: entry.organisationId, period: entry.period },
    };
  });
}
