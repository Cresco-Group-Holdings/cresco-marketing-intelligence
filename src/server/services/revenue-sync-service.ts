import { createHash } from "node:crypto";
import type { RevenueSourceType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { getRevenueAdapter } from "@/lib/revenue/adapters";
import { mapCustomerToIdentity } from "@/lib/revenue/customer-mapping";
import type { RevenueAdapterSyncResult } from "@/lib/revenue/types";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

function idempotencyKey(parts: string[]) {
  return createHash("sha256").update(parts.join(":")).digest("hex");
}

async function persistSyncResult(
  brand: { id: string; projectId: string; organisationId: string },
  sourceType: RevenueSourceType,
  result: RevenueAdapterSyncResult,
) {
  let recordsSynced = 0;
  const identityCache = new Map<string, string | null>();

  async function lookupIdentity(type: string, value: string) {
    const cacheKey = `${type}:${value}`;
    if (identityCache.has(cacheKey)) return identityCache.get(cacheKey) ?? null;
    const identity = await prisma.marketingIdentity.findFirst({
      where: { brandId: brand.id, organisationId: brand.organisationId, identityType: type as never, identityValue: value },
    });
    identityCache.set(cacheKey, identity?.id ?? null);
    return identity?.id ?? null;
  }

  for (const customer of result.customers) {
    if (customer.internalUserId) {
      await lookupIdentity("USER_ID", customer.internalUserId);
    }
    if (customer.crmId) {
      await lookupIdentity("PROVIDER_ID", customer.crmId);
    }

    const mapping = mapCustomerToIdentity(
      {
        internalUserId: customer.internalUserId,
        stripeMetadataUserId: customer.internalUserId,
        crmId: customer.crmId,
      },
      (type, value) => identityCache.get(`${type}:${value}`) ?? null,
    );

    const record = await prisma.revenueCustomer.upsert({
      where: {
        brandId_sourceType_providerCustomerId: {
          brandId: brand.id,
          sourceType,
          providerCustomerId: customer.providerCustomerId,
        },
      },
      create: {
        organisationId: brand.organisationId,
        projectId: brand.projectId,
        brandId: brand.id,
        sourceType,
        providerCustomerId: customer.providerCustomerId,
        email: customer.email,
        displayName: customer.displayName,
        country: customer.country,
        signupAt: customer.signupAt,
        marketingIdentityId: mapping.identityId,
        providerMetadata: (customer.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      update: {
        email: customer.email,
        displayName: customer.displayName,
        marketingIdentityId: mapping.identityId ?? undefined,
        providerMetadata: (customer.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    if (mapping.identityId && mapping.linkMethod) {
      await prisma.revenueCustomerIdentityLink.upsert({
        where: {
          revenueCustomerId_marketingIdentityId: {
            revenueCustomerId: record.id,
            marketingIdentityId: mapping.identityId,
          },
        },
        create: {
          organisationId: brand.organisationId,
          projectId: brand.projectId,
          brandId: brand.id,
          revenueCustomerId: record.id,
          marketingIdentityId: mapping.identityId,
          linkMethod: mapping.linkMethod,
          evidence: mapping.evidence as Prisma.InputJsonValue,
          confidence: mapping.confidence,
        },
        update: { evidence: mapping.evidence as Prisma.InputJsonValue, confidence: mapping.confidence },
      });
    }
    recordsSynced += 1;
  }

  for (const sub of result.subscriptions) {
    const customer = await prisma.revenueCustomer.findFirst({
      where: { brandId: brand.id, sourceType, providerCustomerId: sub.providerCustomerId },
    });
    if (!customer) continue;

    await prisma.revenueSubscription.upsert({
      where: {
        brandId_sourceType_providerSubscriptionId: {
          brandId: brand.id,
          sourceType,
          providerSubscriptionId: sub.providerSubscriptionId,
        },
      },
      create: {
        organisationId: brand.organisationId,
        projectId: brand.projectId,
        brandId: brand.id,
        revenueCustomerId: customer.id,
        sourceType,
        providerSubscriptionId: sub.providerSubscriptionId,
        status: sub.status as never,
        productId: sub.productId,
        productName: sub.productName,
        priceId: sub.priceId,
        planName: sub.planName,
        mrrAmount: sub.mrrAmount,
        currency: sub.currency,
        trialStart: sub.trialStart,
        trialEnd: sub.trialEnd,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        canceledAt: sub.canceledAt,
      },
      update: {
        status: sub.status as never,
        mrrAmount: sub.mrrAmount,
        canceledAt: sub.canceledAt,
      },
    });
    recordsSynced += 1;
  }

  for (const tx of result.transactions) {
    const customer = tx.providerCustomerId
      ? await prisma.revenueCustomer.findFirst({
          where: { brandId: brand.id, sourceType, providerCustomerId: tx.providerCustomerId },
        })
      : null;

    const txKey = idempotencyKey([brand.id, sourceType, tx.providerTransactionId]);
    await prisma.revenueTransaction.upsert({
      where: {
        brandId_sourceType_providerTransactionId: {
          brandId: brand.id,
          sourceType,
          providerTransactionId: tx.providerTransactionId,
        },
      },
      create: {
        organisationId: brand.organisationId,
        projectId: brand.projectId,
        brandId: brand.id,
        revenueCustomerId: customer?.id,
        sourceType,
        transactionType: tx.transactionType,
        providerTransactionId: tx.providerTransactionId,
        originalAmount: tx.originalAmount,
        netAmount: tx.netAmount,
        currency: tx.currency,
        occurredAt: tx.occurredAt,
        invoiceId: tx.invoiceId,
        paymentId: tx.paymentId,
        subscriptionId: tx.subscriptionId,
        isRefund: tx.isRefund ?? false,
        isPartialRefund: tx.isPartialRefund ?? false,
        parentTransactionId: tx.parentTransactionId,
        idempotencyKey: txKey,
        providerMetadata: (tx.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      update: {
        netAmount: tx.netAmount,
        isRefund: tx.isRefund ?? false,
        isPartialRefund: tx.isPartialRefund ?? false,
      },
    });
    recordsSynced += 1;
  }

  return recordsSynced;
}

export const revenueSyncService = {
  async isWebhookProcessed(idempotencyKey: string) {
    const existing = await prisma.revenueSyncRun.findUnique({ where: { idempotencyKey } });
    return existing !== null;
  },

  async applyWebhookData(
    brandId: string,
    sourceType: RevenueSourceType,
    result: RevenueAdapterSyncResult,
    idempotencyKey: string,
    metadata?: Record<string, unknown>,
  ) {
    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      return { recordsSynced: 0 };
    }

    const recordsSynced = await persistSyncResult(
      { id: brand.id, projectId: brand.projectId, organisationId: brand.organisationId },
      sourceType,
      result,
    );

    await prisma.revenueSyncRun.create({
      data: {
        organisationId: brand.organisationId,
        projectId: brand.projectId,
        brandId: brand.id,
        sourceType,
        status: "COMPLETED",
        idempotencyKey,
        recordsSynced,
        completedAt: new Date(),
        lastSyncedAt: new Date(),
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });

    return { recordsSynced };
  },

  async sync(
    brandId: string,
    organisationId: string,
    sourceType: RevenueSourceType,
    context: TenantContext,
    since?: Date,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const adapter = getRevenueAdapter(sourceType);
    if (!adapter.isAvailable()) {
      return { status: "SKIPPED", reason: `${sourceType} adapter is not configured.` };
    }

    const key = idempotencyKey([brandId, sourceType, since?.toISOString() ?? "full"]);
    const existing = await prisma.revenueSyncRun.findUnique({ where: { idempotencyKey: key } });
    if (existing?.status === "COMPLETED") return existing;

    const run = await prisma.revenueSyncRun.upsert({
      where: { idempotencyKey: key },
      create: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        sourceType,
        status: "RUNNING",
        startedAt: new Date(),
        idempotencyKey: key,
      },
      update: { status: "RUNNING", startedAt: new Date(), errorMessage: null },
    });

    try {
      const result = await adapter.sync({ since });
      const recordsSynced = await persistSyncResult(
        { id: brandId, projectId: brand.projectId, organisationId },
        sourceType,
        result,
      );

      return prisma.revenueSyncRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          recordsSynced,
          completedAt: new Date(),
          lastSyncedAt: new Date(),
        },
      });
    } catch (error) {
      await prisma.revenueSyncRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Sync failed.",
          completedAt: new Date(),
        },
      });
      throw error;
    }
  },

  async importManual(
    brandId: string,
    organisationId: string,
    rows: Array<{
      providerCustomerId: string;
      amount: number;
      currency: string;
      occurredAt: string;
      transactionType?: string;
    }>,
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const sourceType = "MANUAL_IMPORT" as const;
    let recordsSynced = 0;

    for (const row of rows) {
      await prisma.revenueCustomer.upsert({
        where: {
          brandId_sourceType_providerCustomerId: {
            brandId,
            sourceType,
            providerCustomerId: row.providerCustomerId,
          },
        },
        create: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          sourceType,
          providerCustomerId: row.providerCustomerId,
        },
        update: {},
      });

      const customer = await prisma.revenueCustomer.findFirst({
        where: { brandId, sourceType, providerCustomerId: row.providerCustomerId },
      });

      const providerTransactionId = `manual_${row.providerCustomerId}_${row.occurredAt}`;
      const txKey = idempotencyKey([brandId, sourceType, providerTransactionId]);

      await prisma.revenueTransaction.upsert({
        where: {
          brandId_sourceType_providerTransactionId: {
            brandId,
            sourceType,
            providerTransactionId,
          },
        },
        create: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          revenueCustomerId: customer?.id,
          sourceType,
          transactionType: (row.transactionType ?? "PAYMENT") as "PAYMENT",
          providerTransactionId,
          originalAmount: row.amount,
          netAmount: row.amount,
          currency: row.currency,
          occurredAt: new Date(row.occurredAt),
          idempotencyKey: txKey,
        },
        update: { netAmount: row.amount },
      });
      recordsSynced += 1;
    }

    return { status: "COMPLETED", recordsSynced };
  },
};
