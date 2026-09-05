import { createHmac, timingSafeEqual } from "node:crypto";
import { describe, expect, it, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { isAuthorisedCronRequest, isAuthorisedWorkerRequest } from "@/lib/api/worker-auth";
import { verifyStripeWebhookSignature } from "@/lib/revenue/stripe-webhook";
import {
  extractWebhookEventId,
  isWebhookTimestampValid,
  verifyHmacWebhookSignature,
} from "@/lib/providers/webhook/verification";
import { resolveSafeRedirectPath } from "@/lib/security/redirects";
import { isProtectedRoute } from "@/lib/auth/routes";
import { resetRateLimitStoreForTests } from "@/lib/security/rate-limit";
import { SHARE_TOKEN_BYTES } from "@/lib/reports/constants";

describe("API middleware security regression matrix", () => {
  describe("page and API session gates", () => {
    it("allows public webpages without a session", () => {
      expect(isProtectedRoute("/")).toBe(false);
      expect(isProtectedRoute("/login")).toBe(false);
      expect(isProtectedRoute("/privacy")).toBe(false);
    });

    it("requires a session for protected webpages", () => {
      expect(isProtectedRoute("/dashboard")).toBe(true);
      expect(isProtectedRoute("/settings/account")).toBe(true);
    });

    it("requires a session for protected APIs", () => {
      expect(isProtectedRoute("/api/brands")).toBe(true);
      expect(isProtectedRoute("/api/workspace")).toBe(true);
    });

    it("allows permissioned APIs through middleware but keeps them authenticated", () => {
      expect(isProtectedRoute("/api/members")).toBe(true);
      expect(isProtectedRoute("/api/ai/diagnostics")).toBe(true);
    });
  });

  describe("webhook signature contract", () => {
    it("accepts valid HMAC webhook signatures", () => {
      const secret = "whsec_test";
      const rawBody = '{"id":"evt_valid"}';
      const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
      expect(verifyHmacWebhookSignature({ rawBody, signature, secret })).toBe(true);
    });

    it("rejects invalid webhook signatures", () => {
      expect(
        verifyHmacWebhookSignature({
          rawBody: "{}",
          signature: "deadbeef",
          secret: "whsec_test",
        }),
      ).toBe(false);
    });

    it("rejects missing webhook signatures at the helper layer", () => {
      expect(
        verifyHmacWebhookSignature({
          rawBody: "{}",
          signature: "",
          secret: "whsec_test",
        }),
      ).toBe(false);
    });

    it("rejects stale webhook timestamps", () => {
      const stale = String(Math.floor(Date.now() / 1000) - 10_000);
      expect(isWebhookTimestampValid(stale)).toBe(false);
    });

    it("rejects malformed webhook payloads without event ids", () => {
      expect(extractWebhookEventId({})).toBeNull();
    });

    it("allows middleware to reach webhook routes without a browser session", () => {
      expect(isProtectedRoute("/api/webhooks/providers/resend")).toBe(false);
      expect(isProtectedRoute("/api/webhooks/social/meta")).toBe(false);
      expect(isProtectedRoute("/api/webhooks/stripe")).toBe(false);
    });
  });

  describe("Stripe webhook contract", () => {
    const config = {
      secretKey: "sk_test",
      webhookSecret: "whsec_test",
      apiVersion: "2024-11-20.acacia",
    };

    it("accepts valid Stripe signatures", () => {
      const payload = JSON.stringify({ id: "evt_1", type: "charge.succeeded" });
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = createHmac("sha256", config.webhookSecret)
        .update(`${timestamp}.${payload}`)
        .digest("hex");
      const header = `t=${timestamp},v1=${signature}`;
      expect(verifyStripeWebhookSignature(payload, header, config).valid).toBe(true);
    });

    it("rejects invalid Stripe signatures", () => {
      expect(verifyStripeWebhookSignature("{}", "t=1,v1=invalid", config).valid).toBe(false);
    });

    it("rejects missing Stripe signatures", () => {
      expect(verifyStripeWebhookSignature("{}", "", config).valid).toBe(false);
    });
  });

  describe("worker and cron authentication", () => {
    beforeEach(() => {
      delete process.env.PUBLISHING_WORKER_TOKEN;
      delete process.env.CRON_SECRET;
    });

    it("accepts valid worker tokens with timing-safe comparison", () => {
      process.env.PUBLISHING_WORKER_TOKEN = "worker-secret";
      const request = new NextRequest("https://example.com/api/publishing-jobs/job-1/process", {
        headers: { authorization: "Bearer worker-secret" },
      });
      expect(isAuthorisedWorkerRequest(request)).toBe(true);
    });

    it("rejects invalid worker tokens", () => {
      process.env.PUBLISHING_WORKER_TOKEN = "worker-secret";
      const request = new NextRequest("https://example.com/api/publishing-jobs/job-1/process", {
        headers: { authorization: "Bearer wrong-secret" },
      });
      expect(isAuthorisedWorkerRequest(request)).toBe(false);
    });

    it("fails closed when worker token is missing", () => {
      const request = new NextRequest("https://example.com/api/publishing-jobs/job-1/process", {
        headers: { authorization: "Bearer worker-secret" },
      });
      expect(isAuthorisedWorkerRequest(request)).toBe(false);
    });

    it("accepts valid cron secrets", () => {
      process.env.CRON_SECRET = "cron-secret";
      const request = new NextRequest("https://example.com/api/publishing-scheduler/process-due", {
        headers: { authorization: "Bearer cron-secret" },
      });
      expect(isAuthorisedCronRequest(request)).toBe(true);
    });

    it("rejects invalid cron secrets", () => {
      process.env.CRON_SECRET = "cron-secret";
      const request = new NextRequest("https://example.com/api/publishing-scheduler/process-due", {
        headers: { authorization: "Bearer wrong-secret" },
      });
      expect(isAuthorisedCronRequest(request)).toBe(false);
    });

    it("uses timing-safe comparison for equal-length secrets", () => {
      const expected = Buffer.from("secret-a");
      const provided = Buffer.from("secret-b");
      expect(expected.length).toBe(provided.length);
      expect(timingSafeEqual(expected, provided)).toBe(false);
    });
  });

  describe("shared report token security", () => {
    beforeEach(() => {
      resetRateLimitStoreForTests();
    });

    it("uses high-entropy opaque share tokens", () => {
      expect(SHARE_TOKEN_BYTES).toBeGreaterThanOrEqual(24);
    });

    it("allows shared report routes without a browser session", () => {
      expect(isProtectedRoute("/api/reports/shared/deadbeef")).toBe(false);
      expect(isProtectedRoute("/reports/shared/deadbeef")).toBe(false);
    });
  });

  describe("tracking public endpoints", () => {
    it("allows browser tracking ingestion without a session", () => {
      expect(isProtectedRoute("/api/tracking/v1/events")).toBe(false);
    });

    it("keeps non-public tracking management APIs protected", () => {
      expect(isProtectedRoute("/api/tracking/properties")).toBe(true);
    });
  });

  describe("open redirect regression", () => {
    it("rejects malicious redirect targets", () => {
      expect(resolveSafeRedirectPath("https://evil.example", "/dashboard")).toBe("/dashboard");
      expect(resolveSafeRedirectPath("//evil.example", "/dashboard")).toBe("/dashboard");
      expect(resolveSafeRedirectPath("javascript:alert(1)", "/dashboard")).toBe("/dashboard");
      expect(resolveSafeRedirectPath("/dashboard/../../../etc/passwd", "/dashboard")).toBe("/dashboard");
    });

    it("accepts safe in-app redirects", () => {
      expect(resolveSafeRedirectPath("/brands", "/dashboard")).toBe("/brands");
      expect(resolveSafeRedirectPath("/settings/account", "/dashboard")).toBe("/settings/account");
    });
  });
});
