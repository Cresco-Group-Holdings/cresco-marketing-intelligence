import { describe, expect, it } from "vitest";
import {
  buildSafeEmailPayload,
  sanitiseEmailBody,
  stripSensitiveSocialContent,
} from "@/lib/notifications/email-security";

describe("email security", () => {
  it("redacts bearer tokens and secrets from email bodies", () => {
    const input = "Auth failed with Bearer sk_live_abc123 and api_key=secret-value";
    const output = sanitiseEmailBody(input);
    expect(output).not.toContain("sk_live_abc123");
    expect(output).not.toContain("secret-value");
    expect(output).toContain("[redacted]");
  });

  it("builds safe internal links and unsubscribe controls", () => {
    const payload = buildSafeEmailPayload({
      subject: "Publishing failed",
      body: "Your post could not be published.",
      organisationName: "Acme Co",
      actionPath: "/operations/publishing",
      allowUnsubscribe: true,
      userId: "user-1",
      organisationId: "org-1",
    });

    expect(payload.actionUrl).toContain("/operations/publishing");
    expect(payload.unsubscribeUrl).toContain("/settings/notifications");
    expect(payload.body).not.toContain("Bearer");
  });

  it("strips sensitive social message content by default", () => {
    const longMessage = "x".repeat(250);
    expect(stripSensitiveSocialContent(longMessage)).toContain("Open the inbox");
    expect(stripSensitiveSocialContent(longMessage)).not.toContain("x".repeat(200));
  });
});
