import { prisma } from "@/lib/database/prisma";
import { verifyStripeWebhookSignature } from "@/lib/revenue/stripe-webhook";
import { getStripeBillingConfig } from "@/server/providers/billing/stripe-billing-provider";
import { getCurrentPlanVersion } from "@/lib/billing/plan-seed";
import { entitlementService } from "@/server/services/entitlement-service";

type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

function extractOrganisationId(event: StripeEvent): string | null {
  const obj = event.data.object;
  const metadata = obj.metadata as Record<string, string> | undefined;
  return metadata?.organisation_id ?? metadata?.organisationId ?? null;
}

export const billingWebhookService = {
  async processStripeEvent(payload: string, signatureHeader: string) {
    const config = getStripeBillingConfig();
    if (!config) {
      throw new Error("Stripe billing is not configured. Webhook rejected.");
    }

    const verified = verifyStripeWebhookSignature(payload, signatureHeader, {
      secretKey: config.secretKey,
      webhookSecret: config.webhookSecret,
      apiVersion: "2024-06-20",
    });
    if (!verified.valid) {
      throw new Error("Invalid Stripe webhook signature.");
    }
    const event = JSON.parse(payload) as StripeEvent;

    const existing = await prisma.billingEvent.findUnique({
      where: { externalEventRef: event.id },
    });
    if (existing) {
      if (existing.status === "PROCESSED") {
        await prisma.billingEvent.update({
          where: { id: existing.id },
          data: { status: "DUPLICATE" },
        });
      }
      return { duplicate: true };
    }

    const organisationId = extractOrganisationId(event);
    let billingAccountId: string | undefined;

    if (organisationId) {
      const account = await prisma.billingAccount.findUnique({ where: { organisationId } });
      billingAccountId = account?.id;
    }

    const billingEvent = await prisma.billingEvent.create({
      data: {
        externalEventRef: event.id,
        eventType: event.type,
        billingAccountId,
        payload: event as object,
        status: "PENDING",
      },
    });

    try {
      await this.handleEvent(event, organisationId);
      await prisma.billingEvent.update({
        where: { id: billingEvent.id },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
    } catch (error) {
      await prisma.billingEvent.update({
        where: { id: billingEvent.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Webhook processing failed.",
        },
      });
      throw error;
    }

    return { duplicate: false, eventType: event.type };
  },

  async handleEvent(event: StripeEvent, organisationId: string | null) {
    const obj = event.data.object;

    switch (event.type) {
      case "checkout.session.completed": {
        if (!organisationId) return;
        const planKey = (obj.metadata as Record<string, string> | undefined)?.plan_key ?? "starter";
        const planVersion = await getCurrentPlanVersion(planKey);
        if (!planVersion) return;

        const account = await prisma.billingAccount.findUnique({ where: { organisationId } });
        if (!account) return;

        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

        await prisma.subscription.upsert({
          where: { billingAccountId: account.id },
          create: {
            billingAccountId: account.id,
            planVersionId: planVersion.id,
            status: "ACTIVE",
            externalSubscriptionRef: String(obj.subscription ?? ""),
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
          update: {
            planVersionId: planVersion.id,
            status: "ACTIVE",
            externalSubscriptionRef: String(obj.subscription ?? ""),
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: false,
          },
        });

        await entitlementService.syncWorkspaceEntitlementsFromPlan(organisationId);
        break;
      }
      case "invoice.paid": {
        if (!organisationId) return;
        const account = await prisma.billingAccount.findUnique({ where: { organisationId } });
        if (!account) return;

        await prisma.billingInvoiceReference.upsert({
          where: { externalInvoiceRef: String(obj.id) },
          create: {
            billingAccountId: account.id,
            externalInvoiceRef: String(obj.id),
            invoiceUrl: typeof obj.hosted_invoice_url === "string" ? obj.hosted_invoice_url : null,
            amountCents: Number(obj.amount_paid ?? 0),
            currency: String(obj.currency ?? "usd").toUpperCase(),
            status: "paid",
          },
          update: {
            invoiceUrl: typeof obj.hosted_invoice_url === "string" ? obj.hosted_invoice_url : null,
            status: "paid",
          },
        });

        await prisma.subscription.updateMany({
          where: { billingAccountId: account.id },
          data: { status: "ACTIVE" },
        });
        break;
      }
      case "invoice.payment_failed": {
        if (!organisationId) return;
        const account = await prisma.billingAccount.findUnique({ where: { organisationId } });
        if (!account) return;
        await prisma.subscription.updateMany({
          where: { billingAccountId: account.id },
          data: { status: "PAST_DUE" },
        });
        break;
      }
      case "customer.subscription.deleted": {
        if (!organisationId) return;
        const account = await prisma.billingAccount.findUnique({ where: { organisationId } });
        if (!account) return;
        await prisma.subscription.updateMany({
          where: { billingAccountId: account.id },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        });
        break;
      }
      case "customer.subscription.updated": {
        if (!organisationId) return;
        const account = await prisma.billingAccount.findUnique({ where: { organisationId } });
        if (!account) return;
        const status = String(obj.status ?? "active").toUpperCase();
        const mapped =
          status === "ACTIVE"
            ? "ACTIVE"
            : status === "PAST_DUE"
              ? "PAST_DUE"
              : status === "CANCELED"
                ? "CANCELLED"
                : status === "TRIALING"
                  ? "TRIALING"
                  : "ACTIVE";
        await prisma.subscription.updateMany({
          where: { billingAccountId: account.id },
          data: {
            status: mapped as "ACTIVE",
            cancelAtPeriodEnd: Boolean(obj.cancel_at_period_end),
          },
        });
        break;
      }
      default:
        break;
    }
  },
};
