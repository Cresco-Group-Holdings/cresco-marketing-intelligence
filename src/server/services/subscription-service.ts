import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import type { BillingInterval } from "@prisma/client";
import { getCurrentPlanVersion } from "@/lib/billing/plan-seed";
import { billingAccountService } from "@/server/services/billing-account-service";
import { entitlementService } from "@/server/services/entitlement-service";
import { stripeBillingProvider } from "@/server/providers/billing/stripe-billing-provider";

export const subscriptionService = {
  async getSubscriptionSummary(organisationId: string) {
    const account = await billingAccountService.getAccount(organisationId);
    const sub = account.subscription;
    const plan = sub?.planVersion.plan;

    return {
      billingAccountId: account.id,
      billingStatus: account.status,
      subscription: sub
        ? {
            id: sub.id,
            status: sub.status,
            billingInterval: sub.billingInterval,
            currentPeriodStart: sub.currentPeriodStart.toISOString(),
            currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            trialEnd: sub.trialEnd?.toISOString() ?? null,
          }
        : null,
      plan: plan
        ? {
            key: plan.key,
            displayName: plan.displayName,
            monthlyPriceCents: sub!.planVersion.monthlyPriceCents,
            annualPriceCents: sub!.planVersion.annualPriceCents,
          }
        : null,
      trial: account.trial
        ? {
            status: account.trial.status,
            endsAt: account.trial.endsAt.toISOString(),
          }
        : null,
    };
  },

  async listPlans() {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        versions: {
          where: { isCurrent: true },
          include: { entitlements: true, allowances: { include: { meter: true } } },
        },
      },
    });

    return plans.map((plan) => ({
      key: plan.key,
      displayName: plan.displayName,
      description: plan.description,
      version: plan.versions[0]
        ? {
            monthlyPriceCents: plan.versions[0].monthlyPriceCents,
            annualPriceCents: plan.versions[0].annualPriceCents,
            trialDays: plan.versions[0].trialDays,
            entitlements: plan.versions[0].entitlements,
            allowances: plan.versions[0].allowances.map((a) => ({
              meterKey: a.meterKey,
              displayName: a.meter.displayName,
              allowance: a.allowance,
              period: a.period,
            })),
          }
        : null,
    }));
  },

  async startCheckout(
    context: TenantContext,
    input: { planKey: string; billingInterval: BillingInterval; successUrl: string; cancelUrl: string; promoCode?: string },
  ) {
    const account = await billingAccountService.getAccount(context.organisationId);
    const planVersion = await getCurrentPlanVersion(input.planKey);
    if (!planVersion) throw new AppError("NOT_FOUND", "Plan not found.");

    let externalCustomerRef = account.externalCustomerRef ?? undefined;
    if (!externalCustomerRef) {
      const customer = await stripeBillingProvider.createCustomer({
        organisationId: context.organisationId,
        email: account.billingEmail ?? undefined,
      });
      externalCustomerRef = customer.externalCustomerRef;
      await prisma.billingAccount.update({
        where: { id: account.id },
        data: { externalCustomerRef },
      });
    }

    const externalPriceRef =
      input.billingInterval === "ANNUAL"
        ? planVersion.externalPriceAnnualRef
        : planVersion.externalPriceMonthlyRef;

    return stripeBillingProvider.createCheckoutSession({
      organisationId: context.organisationId,
      billingAccountId: account.id,
      planKey: input.planKey,
      billingInterval: input.billingInterval,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      customerEmail: account.billingEmail ?? undefined,
      promoCode: input.promoCode,
      externalCustomerRef,
      externalPriceRef: externalPriceRef ?? undefined,
    });
  },

  async openPortal(context: TenantContext, returnUrl: string) {
    const account = await billingAccountService.getAccount(context.organisationId);
    if (!account.externalCustomerRef) {
      throw new AppError("VALIDATION_ERROR", "No billing customer on file.");
    }
    return stripeBillingProvider.createPortalSession({
      organisationId: context.organisationId,
      billingAccountId: account.id,
      externalCustomerRef: account.externalCustomerRef,
      returnUrl,
    });
  },

  async changePlan(context: TenantContext, planKey: string, billingInterval: BillingInterval = "MONTHLY") {
    const account = await billingAccountService.getAccount(context.organisationId);
    const planVersion = await getCurrentPlanVersion(planKey);
    if (!planVersion) throw new AppError("NOT_FOUND", "Plan not found.");

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + (billingInterval === "ANNUAL" ? 12 : 1));

    await prisma.subscription.update({
      where: { billingAccountId: account.id },
      data: {
        planVersionId: planVersion.id,
        billingInterval,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      },
    });

    await entitlementService.syncWorkspaceEntitlementsFromPlan(context.organisationId);
    return this.getSubscriptionSummary(context.organisationId);
  },

  async cancelSubscription(context: TenantContext, immediate = false) {
    const account = await billingAccountService.getAccount(context.organisationId);
    if (!account.subscription) throw new AppError("NOT_FOUND", "No active subscription.");

    await prisma.subscription.update({
      where: { billingAccountId: account.id },
      data: immediate
        ? { status: "CANCELLED", cancelledAt: new Date(), cancelAtPeriodEnd: false }
        : { cancelAtPeriodEnd: true },
    });

    return this.getSubscriptionSummary(context.organisationId);
  },

  async listInvoices(organisationId: string) {
    const account = await billingAccountService.getAccount(organisationId);
    return prisma.billingInvoiceReference.findMany({
      where: { billingAccountId: account.id },
      orderBy: { createdAt: "desc" },
      take: 24,
    });
  },
};
