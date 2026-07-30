import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { buildAttributionRecord, buildIdempotencyKey } from "@/lib/lead-capture-forms/attribution";
import { computeFormAnalytics } from "@/lib/lead-capture-forms/analytics";
import { validateConsentSubmissions } from "@/lib/lead-capture-forms/consent";
import {
  rejectUnknownFields,
  validateFieldDefinition,
  validateSubmissionValue,
} from "@/lib/lead-capture-forms/field-validation";
import { evaluateRoutingRules } from "@/lib/lead-capture-forms/routing";
import { assessSpam } from "@/lib/lead-capture-forms/spam";
import { hashClientIp, validateOrigin, validateRedirectUrl } from "@/lib/lead-capture-forms/security";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

describe("field validation", () => {
  it("validates email fields", () => {
    const def = { fieldKey: "email", fieldType: "EMAIL", label: "Email", isRequired: true };
    expect(validateSubmissionValue(def, "bad").valid).toBe(false);
    expect(validateSubmissionValue(def, "good@example.com").valid).toBe(true);
  });

  it("rejects unknown fields", () => {
    const result = rejectUnknownFields(["email", "hack"], ["email"]);
    expect(result.valid).toBe(false);
    expect(result.unknown).toContain("hack");
  });

  it("rejects dangerous HTML in labels", () => {
    const result = validateFieldDefinition({ fieldKey: "x", fieldType: "TEXT", label: "<script>alert(1)</script>" });
    expect(result.valid).toBe(false);
  });
});

describe("consent", () => {
  it("requires service consent separately from marketing", () => {
    const result = validateConsentSubmissions(
      [{ purpose: "SERVICE_REQUEST", isRequired: true, wordingVersion: "v1" }],
      [{ purpose: "MARKETING_EMAIL", granted: true, wordingVersion: "v1" }],
    );
    expect(result.valid).toBe(false);
  });

  it("accepts valid consent with matching wording version", () => {
    const result = validateConsentSubmissions(
      [{ purpose: "SERVICE_REQUEST", isRequired: true, wordingVersion: "v1" }],
      [{ purpose: "SERVICE_REQUEST", granted: true, wordingVersion: "v1" }],
    );
    expect(result.valid).toBe(true);
  });
});

describe("spam assessment", () => {
  it("quarantines honeypot submissions", () => {
    const result = assessSpam({ honeypotFilled: true });
    expect(result.verdict).toBe("QUARANTINED");
  });

  it("flags suspicious origin mismatch", () => {
    const result = assessSpam({ originMismatch: true });
    expect(result.verdict).toBe("SUSPICIOUS");
  });
});

describe("routing", () => {
  it("matches rules by priority", () => {
    const rule = evaluateRoutingRules(
      [
        { name: "UK", priority: 1, conditions: [{ field: "country", operator: "eq", value: "GB" }], actionType: "ASSIGN_OWNER", actionConfig: { ownerUserId: "u1" } },
        { name: "Default", priority: 99, conditions: [], actionType: "SET_PRODUCT_INTEREST", actionConfig: { productInterest: "GENERAL" } },
      ],
      { fieldValues: { country: "GB" } },
    );
    expect(rule?.name).toBe("UK");
  });
});

describe("attribution", () => {
  it("builds attribution record with form version", () => {
    const record = buildAttributionRecord({ utmCampaign: "spring", pageUrl: "https://example.com" }, "ver-1");
    expect(record.utmCampaign).toBe("spring");
    expect(record.formVersionId).toBe("ver-1");
  });

  it("builds idempotency key", () => {
    expect(buildIdempotencyKey("form-1", "key-abc")).toBe("form-1:key-abc");
  });
});

describe("security", () => {
  it("validates allowed origins", () => {
    expect(validateOrigin("https://example.com", ["https://example.com"])).toBe(true);
    expect(validateOrigin("https://evil.com", ["https://example.com"])).toBe(false);
  });

  it("validates redirect URLs against allowlist", () => {
    const ok = validateRedirectUrl("https://example.com/thanks", ["example.com"]);
    expect(ok.valid).toBe(true);
    const bad = validateRedirectUrl("https://evil.com", ["example.com"]);
    expect(bad.valid).toBe(false);
  });

  it("hashes client IP", () => {
    expect(hashClientIp("1.2.3.4")).toMatch(/^ip_/);
  });
});

describe("analytics", () => {
  it("discloses missing view tracking", () => {
    const analytics = computeFormAnalytics({ submissions: 10, accepted: 8, quarantined: 2, validationFailures: 1 });
    expect(analytics.trackingDisclosure).toContain("not configured");
  });
});

describe("forms permissions", () => {
  it("grants marketers publish but not quarantine review", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["forms.publish"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["forms.reviewQuarantine"])).toBe(false);
  });

  it("grants admins full forms access", () => {
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["forms.manageRouting"])).toBe(true);
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["forms.reviewQuarantine"])).toBe(true);
  });
});
