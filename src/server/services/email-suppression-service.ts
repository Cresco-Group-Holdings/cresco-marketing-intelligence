import type { EmailSuppressionReason } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { normaliseEmailAddress } from "@/lib/email/suppression";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

export const emailSuppressionService = {
  async listSuppressions(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.emailSuppression.findMany({
      where: { organisationId, OR: [{ brandId }, { brandId: null }] },
      orderBy: { suppressedAt: "desc" },
      take: 200,
    });
  },

  async addSuppression(
    brandId: string,
    organisationId: string,
    input: { emailAddress: string; reason: EmailSuppressionReason; source?: string },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const email = normaliseEmailAddress(input.emailAddress);
    return prisma.emailSuppression.upsert({
      where: { organisationId_emailAddress: { organisationId, emailAddress: email } },
      create: {
        organisationId,
        brandId,
        emailAddress: email,
        reason: input.reason,
        source: input.source ?? "MANUAL",
      },
      update: { reason: input.reason, source: input.source, suppressedAt: new Date() },
    });
  },

  async removeSuppression(suppressionId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const record = await prisma.emailSuppression.findFirst({
      where: { id: suppressionId, organisationId },
    });
    if (!record) throw new AppError("NOT_FOUND", "Suppression not found.");
    await prisma.emailSuppression.delete({ where: { id: suppressionId } });
    return { removed: true };
  },

  async recordUnsubscribe(
    brandId: string,
    organisationId: string,
    input: { emailAddress: string; category?: string; source?: string },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const email = normaliseEmailAddress(input.emailAddress);
    await prisma.$transaction([
      prisma.emailUnsubscribe.upsert({
        where: {
          organisationId_emailAddress_category: {
            organisationId,
            emailAddress: email,
            category: (input.category as "MARKETING") ?? null,
          },
        },
        create: {
          organisationId,
          brandId,
          emailAddress: email,
          category: input.category as "MARKETING" | undefined,
          source: input.source ?? "LINK",
        },
        update: { unsubscribedAt: new Date() },
      }),
      prisma.emailSuppression.upsert({
        where: { organisationId_emailAddress: { organisationId, emailAddress: email } },
        create: { organisationId, brandId, emailAddress: email, reason: "UNSUBSCRIBE", source: input.source },
        update: { reason: "UNSUBSCRIBE", suppressedAt: new Date() },
      }),
    ]);
    return { unsubscribed: true };
  },
};
