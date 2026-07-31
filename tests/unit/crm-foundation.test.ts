import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import {
  isValidContactValue,
  normaliseContactValue,
  normaliseEmail,
  normalisePhone,
} from "@/lib/crm/contact-normalisation";
import { validateCustomFieldDefinition, validateCustomFieldValue } from "@/lib/crm/custom-fields";
import { buildDuplicateEvidence, canAutoMerge } from "@/lib/crm/duplicates";
import { canAutoLink, validateIdentityLink } from "@/lib/crm/identity-linking";
import { buildMergePreview, resolveConsentOnMerge } from "@/lib/crm/merge";
import { validateImportMapping, sanitiseCsvRow } from "@/lib/crm/import-export";
import { buildTransitionRecord, validateLifecycleTransition, validateStatusTransition } from "@/lib/crm/transitions";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

describe("CRM status transitions", () => {
  it("accepts valid operational statuses", () => {
    expect(validateStatusTransition("QUALIFIED").valid).toBe(true);
    expect(validateStatusTransition("INVALID").valid).toBe(false);
  });

  it("records transition metadata", () => {
    const record = buildTransitionRecord({
      previousValue: "NEW",
      newValue: "CONTACTED",
      actorUserId: "user-1",
      reason: "Called prospect",
    });
    expect(record.previousValue).toBe("NEW");
    expect(record.newValue).toBe("CONTACTED");
    expect(record.actorUserId).toBe("user-1");
    expect(record.source).toBe("MANUAL");
  });
});

describe("CRM lifecycle transitions", () => {
  it("accepts valid lifecycle stages separately from status", () => {
    expect(validateLifecycleTransition("MARKETING_QUALIFIED").valid).toBe(true);
    expect(validateLifecycleTransition("NOT_A_STAGE").valid).toBe(false);
  });
});

describe("contact normalisation", () => {
  it("normalises email and phone deterministically", () => {
    expect(normaliseEmail("  Alex@Example.COM ")).toBe("alex@example.com");
    expect(normalisePhone("+44 (0)20 7946 0958")).toBe("4402079460958");
    expect(normaliseContactValue("EMAIL", "test@example.com")).toBe("test@example.com");
  });

  it("validates contact values", () => {
    expect(isValidContactValue("EMAIL", "bad")).toBe(false);
    expect(isValidContactValue("EMAIL", "good@example.com")).toBe(true);
    expect(isValidContactValue("PHONE", "123")).toBe(false);
    expect(isValidContactValue("PHONE", "+1 555 123 4567")).toBe(true);
  });
});

describe("deterministic identity linking", () => {
  it("allows verified deterministic link types", () => {
    const result = validateIdentityLink({
      linkType: "VERIFIED_EMAIL",
      externalId: "alex@example.com",
      verified: true,
    });
    expect(result.valid).toBe(true);
    expect(canAutoLink({ linkType: "VERIFIED_EMAIL", externalId: "alex@example.com", verified: true })).toBe(true);
  });

  it("rejects prohibited evidence", () => {
    const result = validateIdentityLink({
      linkType: "STAFF_CONFIRMED",
      externalId: "lead-1",
      evidence: "ai_confidence match",
    });
    expect(result.valid).toBe(false);
  });
});

describe("duplicate rules", () => {
  it("builds high-confidence evidence for exact email", () => {
    const evidence = buildDuplicateEvidence({ email: "Alex@Example.com" });
    expect(evidence).toHaveLength(1);
    expect(evidence[0].type).toBe("exact_verified_email");
    expect(canAutoMerge(evidence)).toBe(true);
  });

  it("does not auto-merge on medium-confidence company+name match", () => {
    const evidence = buildDuplicateEvidence({ companyDomain: "acme.com", exactName: "Alex Smith" });
    expect(evidence[0].confidence).toBe("MEDIUM");
    expect(canAutoMerge(evidence)).toBe(false);
  });
});

describe("merge conflict handling and consent preservation", () => {
  it("previews field conflicts", () => {
    const preview = buildMergePreview(
      "src",
      "dest",
      { email: "a@example.com", status: "NEW" },
      { email: "b@example.com", status: "NEW" },
      3,
    );
    expect(preview.conflicts.some((c) => c.field === "email")).toBe(true);
    expect(preview.attributionPreserved).toBe(true);
  });

  it("keeps most restrictive consent on merge", () => {
    const merged = resolveConsentOnMerge(
      [{ channel: "email", granted: true }],
      [{ channel: "email", granted: false }],
    );
    expect(merged[0].granted).toBe(false);
  });
});

describe("custom field validation", () => {
  it("validates field definitions", () => {
    const ok = validateCustomFieldDefinition({ fieldKey: "grant_region", label: "Grant region", fieldType: "TEXT" });
    expect(ok.valid).toBe(true);
    const bad = validateCustomFieldDefinition({ fieldKey: "Bad Key", label: "", fieldType: "SQL" });
    expect(bad.valid).toBe(false);
  });

  it("validates field values", () => {
    expect(validateCustomFieldValue("NUMBER", 42).valid).toBe(true);
    expect(validateCustomFieldValue("EMAIL", "not-an-email").valid).toBe(false);
  });
});

describe("import mapping and CSV safety", () => {
  it("requires mapped email column", () => {
    const result = validateImportMapping({ col: "name" }, ["email"]);
    expect(result.valid).toBe(false);
  });

  it("sanitises formula injection prefixes", () => {
    const row = sanitiseCsvRow({ email: "=cmd|'/c calc'!A0" });
    expect(row.email.startsWith("'")).toBe(true);
  });
});

describe("CRM permissions", () => {
  it("grants marketers read and create but not merge by default", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["crm.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["crm.create"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["crm.mergeRecords"])).toBe(false);
  });

  it("grants admins full CRM capabilities", () => {
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["crm.mergeRecords"])).toBe(true);
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["crm.manageConsent"])).toBe(true);
  });

  it("limits viewers to read", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["crm.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["crm.create"])).toBe(false);
  });
});
