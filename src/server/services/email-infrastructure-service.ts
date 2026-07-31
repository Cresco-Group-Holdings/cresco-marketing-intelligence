import type { EmailProviderType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { buildConfigInstructions, isDomainReadyForSending, resolveSendingStatus } from "@/lib/email/domain-verification";
import { getEmailProviderAdapter } from "@/lib/email/providers/registry";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

export const emailInfrastructureService = {
  async listProviders(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.emailProviderConnection.findMany({
      where: { organisationId, OR: [{ brandId }, { brandId: null }] },
      orderBy: { createdAt: "desc" },
    });
  },

  async createProvider(
    brandId: string,
    organisationId: string,
    input: { providerType: EmailProviderType; name: string; config?: Prisma.InputJsonValue; isDefault?: boolean },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    if (input.isDefault) {
      await prisma.emailProviderConnection.updateMany({
        where: { organisationId, brandId },
        data: { isDefault: false },
      });
    }
    return prisma.emailProviderConnection.create({
      data: {
        organisationId,
        brandId,
        providerType: input.providerType,
        name: input.name,
        config: input.config,
        isDefault: input.isDefault ?? false,
      },
    });
  },

  async listDomains(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.emailSendingDomain.findMany({
      where: { organisationId, OR: [{ brandId }, { brandId: null }] },
      include: { providerConnection: true, verifications: true, senderIdentities: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async addDomain(
    brandId: string,
    organisationId: string,
    input: { domain: string; providerConnectionId: string; customReturnPath?: string },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const connection = await prisma.emailProviderConnection.findFirst({
      where: { id: input.providerConnectionId, organisationId },
    });
    if (!connection) throw new AppError("NOT_FOUND", "Provider connection not found.");

    const adapter = getEmailProviderAdapter(connection.providerType);
    const verification = await adapter.verifyDomain(input.domain, (connection.config as Record<string, unknown>) ?? {});

    return prisma.$transaction(async (tx) => {
      const domain = await tx.emailSendingDomain.create({
        data: {
          organisationId,
          brandId,
          providerConnectionId: input.providerConnectionId,
          domain: input.domain.toLowerCase(),
          customReturnPath: input.customReturnPath,
          spfStatus: verification.spfStatus,
          dkimStatus: verification.dkimStatus,
          dmarcStatus: verification.dmarcStatus,
          providerVerified: false,
          sendingStatus: "PENDING",
          configInstructions: verification.instructions,
        },
      });
      for (const instr of verification.instructions) {
        await tx.emailDomainVerification.create({
          data: {
            domainId: domain.id,
            verificationType: instr.type,
            status: "PENDING",
            recordName: instr.name,
            recordValue: instr.value,
          },
        });
      }
      return domain;
    });
  },

  async checkDomain(domainId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const domain = await prisma.emailSendingDomain.findFirst({
      where: { id: domainId, organisationId },
      include: { providerConnection: true, verifications: true },
    });
    if (!domain) throw new AppError("NOT_FOUND", "Domain not found.");

    const adapter = getEmailProviderAdapter(domain.providerConnection.providerType);
    const result = await adapter.verifyDomain(domain.domain, (domain.providerConnection.config as Record<string, unknown>) ?? {});

    const ready = isDomainReadyForSending({
      spfStatus: result.spfStatus,
      dkimStatus: result.dkimStatus,
      dmarcStatus: result.dmarcStatus,
      providerVerified: result.providerVerified,
    });

    return prisma.emailSendingDomain.update({
      where: { id: domainId },
      data: {
        spfStatus: result.spfStatus,
        dkimStatus: result.dkimStatus,
        dmarcStatus: result.dmarcStatus,
        providerVerified: result.providerVerified,
        sendingStatus: ready ? "READY" : resolveSendingStatus({
          spfStatus: result.spfStatus,
          dkimStatus: result.dkimStatus,
          dmarcStatus: result.dmarcStatus,
          providerVerified: result.providerVerified,
        }),
        lastCheckedAt: new Date(),
        configInstructions: result.instructions.length > 0 ? result.instructions : buildConfigInstructions(domain.domain, "include:provider"),
      },
    });
  },

  async listSenders(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.emailSenderIdentity.findMany({
      where: { organisationId, OR: [{ brandId }, { brandId: null }] },
      include: { domain: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async createSender(
    brandId: string,
    organisationId: string,
    input: {
      domainId: string;
      displayName: string;
      emailAddress: string;
      replyTo?: string;
      purpose?: string;
      allowedCategories?: string[];
      isDefault?: boolean;
    },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const domain = await prisma.emailSendingDomain.findFirst({
      where: { id: input.domainId, organisationId },
    });
    if (!domain) throw new AppError("NOT_FOUND", "Domain not found.");
    if (domain.sendingStatus !== "READY") {
      throw new AppError("VALIDATION_ERROR", "Domain is not ready for sending. Complete verification first.");
    }
    if (!input.emailAddress.endsWith(`@${domain.domain}`)) {
      throw new AppError("VALIDATION_ERROR", "Sender email must use the verified domain.");
    }

    return prisma.emailSenderIdentity.create({
      data: {
        organisationId,
        brandId,
        domainId: input.domainId,
        displayName: input.displayName,
        emailAddress: input.emailAddress.toLowerCase(),
        replyTo: input.replyTo,
        purpose: input.purpose,
        allowedCategories: (input.allowedCategories ?? ["ESSENTIAL_TRANSACTIONAL", "ACCOUNT"]) as ("ESSENTIAL_TRANSACTIONAL" | "ACCOUNT")[],
        isDefault: input.isDefault ?? false,
        verificationStatus: "VERIFIED",
        verifiedAt: new Date(),
      },
    });
  },

  async getTrackingPolicy(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.emailTrackingPolicy.findFirst({
      where: { organisationId, OR: [{ brandId }, { brandId: null }] },
    });
  },

  async upsertTrackingPolicy(
    brandId: string,
    organisationId: string,
    input: {
      openTrackingEnabled?: boolean;
      clickTrackingEnabled?: boolean;
      utmParameters?: Prisma.InputJsonValue;
      firstPartyRedirectEnabled?: boolean;
      requireConsent?: boolean;
      restrictedRegions?: string[];
    },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const existing = await prisma.emailTrackingPolicy.findFirst({
      where: { organisationId, brandId },
    });
    if (existing) {
      return prisma.emailTrackingPolicy.update({
        where: { id: existing.id },
        data: input,
      });
    }
    return prisma.emailTrackingPolicy.create({
      data: { organisationId, brandId, ...input },
    });
  },
};
