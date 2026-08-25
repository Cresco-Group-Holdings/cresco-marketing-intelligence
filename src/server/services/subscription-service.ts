import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import type { BillingInterval } from "@prisma/client";
import { isProductionRuntime } from "@/lib/providers/oauth/runtime";
import { getCurrentPlanVersion } from "@/lib/billing/plan-seed";
import { resolvePlanKeyFromStripePriceId } from "@/lib/billing/commercial-config";
import { trackCommercialEvent } from "@/lib/billing/commercial-analytics";
import { mapStripeStatusToSubscriptionStatus } from "@/lib/billing/subscription-state";
import { isStripeBillingConfigured } from "@/server/providers/billing/stripe-billing-provider";
import { billingAccountService } from "@/server/services/billing-account-service";
import { entitlementService } from "@/server/services/entitlement-service";
import { stripeBillingProvider } from "@/server/providers/billing/stripe-billing-provider";
import { recordAuditEvent } from "@/server/services/audit-service";

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

    if (isProductionRuntime() && isStripeBillingConfigured() && !externalPriceRef) {
      throw new AppError(
        "AUTH_CONFIGURATION_ERROR",
        `Stripe price is not configured for plan ${input.planKey}.`,
      );
    }

    trackCommercialEvent("checkout_started", {
      organisationId: context.organisationId,
      planKey: input.planKey,
      billingInterval: input.billingInterval,
    });

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
    if (isProductionRuntime() && isStripeBillingConfigured()) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Plan changes must be completed through checkout or the billing portal in production.",
      );
    }

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

    if (account.subscription.externalSubscriptionRef && !immediate) {
      await stripeBillingProvider.cancelSubscriptionAtPeriodEnd(
        account.subscription.externalSubscriptionRef,
      );
    }

    await prisma.subscription.update({
      where: { billingAccountId: account.id },
      data: immediate
        ? { status: "CANCELLED", cancelledAt: new Date(), cancelAtPeriodEnd: false }
        : { cancelAtPeriodEnd: true },
    });

    trackCommercialEvent("cancellation_requested", {
      organisationId: context.organisationId,
      immediate,
    });

    await recordAuditEvent({
      organisationId: context.organisationId,
      actorUserId: context.userProfileId,
      action: "billing.cancellation_requested",
      resourceType: "Subscription",
      resourceId: account.subscription.id,
      metadata: { immediate },
    });

    return this.getSubscriptionSummary(context.organisationId);
  },

  async resumeSubscription(context: TenantContext) {
    const account = await billingAccountService.getAccount(context.organisationId);
    if (!account.subscription?.externalSubscriptionRef) {
      throw new AppError("VALIDATION_ERROR", "No subscription to resume.");
    }

    await stripeBillingProvider.resumeSubscription(account.subscription.externalSubscriptionRef);
    await prisma.subscription.update({
      where: { billingAccountId: account.id },
      data: { cancelAtPeriodEnd: false },
    });

    trackCommercialEvent("subscription_resumed", {
      organisationId: context.organisationId,
    });

    await recordAuditEvent({
      organisationId: context.organisationId,
      actorUserId: context.userProfileId,
      action: "billing.subscription_resumed",
      resourceType: "Subscription",
      resourceId: account.subscription.id,
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

  async reconcileWithStripe(context: TenantContext) {
    const account = await billingAccountService.getAccount(context.organisationId);
    const subscriptionRef = account.subscription?.externalSubscriptionRef;
    if (!subscriptionRef) {
      throw new AppError("VALIDATION_ERROR", "No Stripe subscription reference to reconcile.");
    }

    const remote = await stripeBillingProvider.retrieveSubscription(subscriptionRef);
    if (!remote) {
      throw new AppError("UPSTREAM_ERROR", "Unable to retrieve subscription from Stripe.");
    }

    const mappedStatus = mapStripeStatusToSubscriptionStatus(remote.status);
    let planVersionId = account.subscription!.planVersionId;

    if (remote.priceId) {
      const planKey = resolvePlanKeyFromStripePriceId(remote.priceId);
      if (planKey) {
        const planVersion = await getCurrentPlanVersion(planKey);
        if (planVersion) planVersionId = planVersion.id;
      }
    }

    await prisma.subscription.update({
      where: { billingAccountId: account.id },
      data: {
        status: mappedStatus,
        planVersionId,
        currentPeriodStart: remote.currentPeriodStart,
        currentPeriodEnd: remote.currentPeriodEnd,
        cancelAtPeriodEnd: remote.cancelAtPeriodEnd,
      },
    });

    await entitlementService.syncWorkspaceEntitlementsFromPlan(context.organisationId);

    trackCommercialEvent("subscription_reconciled", {
      organisationId: context.organisationId,
      status: mappedStatus,
    });

    await recordAuditEvent({
      organisationId: context.organisationId,
      actorUserId: context.userProfileId,
      action: "billing.subscription_reconciled",
      resourceType: "Subscription",
      resourceId: account.subscription!.id,
      metadata: { status: mappedStatus },
    });

    return this.getSubscriptionSummary(context.organisationId);
  },
};
