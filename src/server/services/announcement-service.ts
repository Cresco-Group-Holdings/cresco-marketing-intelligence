import { prisma } from "@/lib/database/prisma";

export const announcementService = {
  async listActive() {
    const now = new Date();
    return prisma.systemAnnouncement.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { startsAt: "desc" },
    });
  },

  async listAll() {
    return prisma.systemAnnouncement.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  },

  async create(input: {
    title: string;
    message: string;
    severity?: string;
    startsAt?: Date;
    endsAt?: Date;
    createdById?: string;
  }) {
    return prisma.systemAnnouncement.create({
      data: {
        title: input.title,
        message: input.message,
        severity: input.severity ?? "info",
        startsAt: input.startsAt ?? new Date(),
        endsAt: input.endsAt,
        createdById: input.createdById,
      },
    });
  },

  async deactivate(id: string) {
    return prisma.systemAnnouncement.update({
      where: { id },
      data: { isActive: false },
    });
  },
};
