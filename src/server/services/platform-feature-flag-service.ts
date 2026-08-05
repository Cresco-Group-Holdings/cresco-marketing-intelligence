import { prisma } from "@/lib/database/prisma";
import type { Prisma } from "@prisma/client";

export const platformFeatureFlagService = {
  async list() {
    return prisma.platformFeatureFlag.findMany({ orderBy: { key: "asc" } });
  },

  async isEnabled(key: string): Promise<boolean> {
    const flag = await prisma.platformFeatureFlag.findUnique({ where: { key } });
    return flag?.enabled ?? false;
  },

  async upsert(input: {
    key: string;
    displayName: string;
    description?: string;
    enabled: boolean;
    metadata?: Record<string, unknown>;
  }) {
    const data = {
      key: input.key,
      displayName: input.displayName,
      description: input.description,
      enabled: input.enabled,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    };
    return prisma.platformFeatureFlag.upsert({
      where: { key: input.key },
      create: data,
      update: {
        displayName: data.displayName,
        description: data.description,
        enabled: data.enabled,
        metadata: data.metadata,
      },
    });
  },
};
