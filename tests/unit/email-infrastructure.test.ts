import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { checkConsentEligibility } from "@/lib/email/consent";
import { isDomainReadyForSending, resolveSendingStatus } from "@/lib/email/domain-verification";
import { detectDeliverabilityWarnings, shouldShutdownSending } from "@/lib/email/deliverability";
import { canCancel, canDispatch, checkTenantQuota } from "@/lib/email/send-pipeline";
import { isMarketingCategory, normaliseEmailAddress, shouldBlockSend } from "@/lib/email/suppression";
import { extractTemplateVariables, renderTemplate, validateTemplateVariables } from "@/lib/email/template-variables";
import { sanitiseEmailHtml } from "@/lib/email/template-sanitise";
import { buildWebhookIdempotencyKey, normaliseEventType } from "@/lib/email/webhooks";
import { createHmac } from "crypto";
import { getEmailProviderAdapter } from "@/lib/email/providers/registry";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

describe("domain readiness", () => {
  it("requires SPF, DKIM and provider verification", () => {
    expect(isDomainReadyForSending({ spfStatus: "PASS", dkimStatus: "PASS", dmarcStatus: "UNKNOWN", providerVerified: true })).toBe(true);
    expect(isDomainReadyForSending({ spfStatus: "PASS", dkimStatus: "PENDING", dmarcStatus: "PASS", providerVerified: true })).toBe(false);
    expect(isDomainReadyForSending({ spfStatus: "PASS", dkimStatus: "PASS", dmarcStatus: "PASS", providerVerified: false })).toBe(false);
  });

  it("resolves sending status", () => {
    expect(resolveSendingStatus({ spfStatus: "PASS", dkimStatus: "PASS", dmarcStatus: "PASS", providerVerified: true })).toBe("READY");
    expect(resolveSendingStatus({ spfStatus: "FAIL", dkimStatus: "PASS", dmarcStatus: "PASS", providerVerified: true })).toBe("FAILED");
  });
});

describe("template variables", () => {
  it("extracts variables from content", () => {
    expect(extractTemplateVariables("Hello {{firstName}} at {{company}}")).toEqual(["firstName", "company"]);
  });

  it("rejects unapproved variables", () => {
    const result = validateTemplateVariables(["firstName", "sqlInjection"]);
    expect(result.valid).toBe(false);
  });

  it("allows permitted CRM fields", () => {
    const result = validateTemplateVariables(["crm.customField1"], ["customField1"]);
    expect(result.valid).toBe(true);
  });

  it("handles missing variables safely", () => {
    const { rendered, missing } = renderTemplate("Hi {{firstName}}", {});
    expect(rendered).toBe("Hi ");
    expect(missing).toContain("firstName");
  });
});

describe("template sanitisation", () => {
  it("blocks script tags", () => {
    const { sanitised, blocked } = sanitiseEmailHtml('<p>Hi</p><script>alert(1)</script>');
    expect(blocked).toContain("script tags");
    expect(sanitised).not.toContain("<script");
  });
});

describe("consent and suppression", () => {
  it("requires marketing consent for marketing", () => {
    expect(checkConsentEligibility("MARKETING", { marketing: false, transactional: true }).eligible).toBe(false);
    expect(checkConsentEligibility("MARKETING", { marketing: true, transactional: true }).eligible).toBe(true);
  });

  it("blocks marketing sends for suppressed addresses", () => {
    const block = shouldBlockSend("MARKETING", { emailAddress: "a@b.com", reason: "UNSUBSCRIBE", suppressed: true }, false);
    expect(block.blocked).toBe(true);
  });

  it("allows transactional for soft suppressions", () => {
    const block = shouldBlockSend("ESSENTIAL_TRANSACTIONAL", null, false);
    expect(block.blocked).toBe(false);
  });

  it("blocks transactional for hard bounce", () => {
    const block = shouldBlockSend("ESSENTIAL_TRANSACTIONAL", { emailAddress: "a@b.com", reason: "HARD_BOUNCE", suppressed: true }, false);
    expect(block.blocked).toBe(true);
  });

  it("normalises email addresses", () => {
    expect(normaliseEmailAddress("  Test@Example.COM ")).toBe("test@example.com");
  });
});

describe("send pipeline", () => {
  it("allows dispatch for queued messages", () => {
    expect(canDispatch({ status: "QUEUED", retryCount: 0, scheduledAt: null, cancelledAt: null })).toBe(true);
  });

  it("blocks cancelled messages", () => {
    expect(canDispatch({ status: "QUEUED", retryCount: 0, scheduledAt: null, cancelledAt: new Date() })).toBe(false);
  });

  it("allows cancellation before dispatch", () => {
    expect(canCancel({ status: "QUEUED", retryCount: 0, scheduledAt: null, cancelledAt: null })).toBe(true);
    expect(canCancel({ status: "SENT", retryCount: 0, scheduledAt: null, cancelledAt: null })).toBe(false);
  });

  it("enforces tenant quotas", () => {
    expect(checkTenantQuota(10_000, 10_000).allowed).toBe(false);
    expect(checkTenantQuota(100, 10_000).allowed).toBe(true);
  });
});

describe("webhooks", () => {
  it("normalises event types", () => {
    expect(normaliseEventType("bounce")).toBe("BOUNCED");
    expect(normaliseEventType("complaint")).toBe("COMPLAINED");
  });

  it("builds idempotency keys", () => {
    const key = buildWebhookIdempotencyKey("evt-1", "DELIVERED", "a@b.com", new Date("2026-01-01"));
    expect(key).toBe("evt-1");
  });

  it("verifies webhook signatures", () => {
    const adapter = getEmailProviderAdapter("RESEND");
    const payload = '{"event":"delivered"}';
    const secret = "test-secret";
    const signature = createHmac("sha256", secret).update(payload).digest("hex");
    expect(adapter.verifyWebhookSignature(payload, signature, secret)).toBe(true);
    expect(adapter.verifyWebhookSignature(payload, "invalid", secret)).toBe(false);
  });
});

describe("deliverability", () => {
  it("detects complaint shutdown threshold", () => {
    const warnings = detectDeliverabilityWarnings({
      sentCount: 1000, deliveredCount: 990, bounceCount: 5, hardBounceCount: 2,
      complaintCount: 5, unsubscribeCount: 10, rejectionCount: 0,
    });
    expect(shouldShutdownSending(warnings)).toBe(true);
  });
});

describe("email permissions", () => {
  it("grants admins full email access", () => {
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["email.manageProviders"])).toBe(true);
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["email.sendMarketing"])).toBe(true);
  });

  it("limits viewers to read and deliverability", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["email.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["email.sendMarketing"])).toBe(false);
  });
});

describe("message categories", () => {
  it("identifies marketing categories", () => {
    expect(isMarketingCategory("MARKETING")).toBe(true);
    expect(isMarketingCategory("ESSENTIAL_TRANSACTIONAL")).toBe(false);
  });
});
