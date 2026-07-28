import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";
import {
  brandAudienceCreateSchema,
  brandKnowledgeImportSchema,
  brandOfferCreateSchema,
} from "@/lib/validation/brand-knowledge";
import { stripOwnershipFields } from "@/lib/brand-knowledge/import-export";

describe("brand knowledge permissions", () => {
  it("allows marketers to update brand knowledge", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["brandKnowledge.update"])).toBe(true);
  });

  it("denies viewers from updating brand knowledge", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["brandKnowledge.update"])).toBe(false);
  });

  it("allows analysts to read brand knowledge", () => {
    expect(hasPermission(OrganisationRole.ANALYST, PERMISSIONS["brandKnowledge.read"])).toBe(true);
  });
});

describe("brand knowledge validation", () => {
  it("accepts valid audience payloads", () => {
    const parsed = brandAudienceCreateSchema.parse({
      name: "UK charities",
      countries: ["GB"],
      painPoints: ["Complex applications"],
    });

    expect(parsed.name).toBe("UK charities");
  });

  it("rejects audience names that are too long", () => {
    expect(() => brandAudienceCreateSchema.parse({ name: "x".repeat(200) })).toThrow();
  });

  it("accepts valid offer payloads with optional URLs", () => {
    const parsed = brandOfferCreateSchema.parse({
      name: "Advisory package",
      landingPageUrl: "",
      availabilityStatus: "AVAILABLE",
    });

    expect(parsed.name).toBe("Advisory package");
  });

  it("validates import payloads with version metadata", () => {
    const parsed = brandKnowledgeImportSchema.parse({
      version: "1.0.0",
      personas: [{ name: "Retail investor" }],
    });

    expect(parsed.version).toBe("1.0.0");
    expect(parsed.personas).toHaveLength(1);
  });

  it("rejects import payloads without a version", () => {
    expect(() => brandKnowledgeImportSchema.parse({ personas: [] })).toThrow();
  });
});

describe("import ownership sanitisation", () => {
  it("strips tenant and ownership fields from imported records", () => {
    const sanitised = stripOwnershipFields({
      id: "foreign-id",
      organisationId: "foreign-org",
      projectId: "foreign-project",
      brandId: "foreign-brand",
      createdAt: "2020-01-01",
      updatedAt: "2020-01-01",
      archivedAt: null,
      name: "Retail investor",
    });

    expect(sanitised).toEqual({ name: "Retail investor" });
  });
});
