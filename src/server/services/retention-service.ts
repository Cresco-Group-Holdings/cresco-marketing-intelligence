import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";

export const DEFAULT_RETENTION_POLICIES = [
  { resourceType: "audit_log", retentionDays: 365, description: "Organisation audit events" },
  { resourceType: "security_audit_log", retentionDays: 730, description: "Platform security audit events" },
  { resourceType: "usage_record", retentionDays: 395, description: "Billing usage records (13 months)" },
  { resourceType: "provider_audit_event", retentionDays: 365, description: "Provider credential access audit" },
  { resourceType: "operational_alert", retentionDays: 90, description: "Resolved operational alerts" },
] as const;

export const retentionService = {
  async ensureDefaultPolicies() {
    for (const policy of DEFAULT_RETENTION_POLICIES) {
      await prisma.dataRetentionPolicy.upsert({
        where: { resourceType: policy.resourceType },
        create: policy,
        update: { description: policy.description },
      });
    }
  },

  async listPolicies() {
    await this.ensureDefaultPolicies();
    return prisma.dataRetentionPolicy.findMany({ orderBy: { resourceType: "asc" } });
  },

  async updatePolicy(resourceType: string, retentionDays: number, anonymiseAfter?: number) {
    if (retentionDays < 1) {
      throw new AppError("VALIDATION_ERROR", "Retention days must be at least 1.");
    }

    return prisma.dataRetentionPolicy.upsert({
      where: { resourceType },
      create: { resourceType, retentionDays, anonymiseAfter },
      update: { retentionDays, anonymiseAfter, isActive: true },
    });
  },

  async purgeExpiredAuditLogs() {
    const policy = await prisma.dataRetentionPolicy.findUnique({
      where: { resourceType: "audit_log" },
    });
    if (!policy?.isActive) return { purged: 0 };

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - policy.retentionDays);

    const result = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return { purged: result.count, cutoff: cutoff.toISOString() };
  },

  async purgeExpiredSecurityAuditLogs() {
    const policy = await prisma.dataRetentionPolicy.findUnique({
      where: { resourceType: "security_audit_log" },
    });
    if (!policy?.isActive) return { purged: 0 };

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - policy.retentionDays);

    const result = await prisma.securityAuditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return { purged: result.count, cutoff: cutoff.toISOString() };
  },
};
