import { prisma } from "@/lib/database/prisma";

function parsePlatformAdminEmails(): Set<string> {
  const raw = process.env.PLATFORM_ADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export const platformAdminService = {
  async isPlatformAdmin(userProfileId: string, email?: string): Promise<boolean> {
    const grant = await prisma.platformAdminGrant.findUnique({
      where: { userProfileId },
    });
    if (grant) return true;

    if (email && parsePlatformAdminEmails().has(email.toLowerCase())) {
      return true;
    }

    return false;
  },

  async assertPlatformAdmin(userProfileId: string, email?: string): Promise<void> {
    const allowed = await this.isPlatformAdmin(userProfileId, email);
    if (!allowed) {
      throw new Error("PLATFORM_ADMIN_REQUIRED");
    }
  },

  async listGrants() {
    return prisma.platformAdminGrant.findMany({
      include: {
        userProfile: { select: { id: true, email: true, displayName: true } },
        grantedBy: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async grantAccess(input: {
    userProfileId: string;
    grantedById: string;
    reason?: string;
  }) {
    return prisma.platformAdminGrant.upsert({
      where: { userProfileId: input.userProfileId },
      create: {
        userProfileId: input.userProfileId,
        grantedById: input.grantedById,
        reason: input.reason,
      },
      update: {
        grantedById: input.grantedById,
        reason: input.reason,
      },
    });
  },

  async revokeAccess(userProfileId: string) {
    await prisma.platformAdminGrant.deleteMany({ where: { userProfileId } });
  },
};
