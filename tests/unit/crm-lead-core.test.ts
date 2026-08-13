import { describe, expect, it } from "vitest";
import {
  CRM_LEAD_WORKFLOW_STATUSES,
  getAllowedNextStatuses,
  mapWorkflowToLifecycleStage,
  mapWorkflowToQualificationState,
  validateWorkflowTransition,
} from "@/lib/crm/lead-workflow";
import {
  assertNoPiiInUrl,
  buildAnonymisationPreview,
  containsPiiInUrl,
  minimiseCrmLeadExport,
  redactForRestrictedLog,
  sanitiseActivityMetadata,
} from "@/lib/crm/pii-safe";
import { buildDuplicateEvidence, canAutoMerge } from "@/lib/crm/duplicates";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";
import { OrganisationRole } from "@prisma/client";

describe("CRM lead workflow", () => {
  it("defines the required qualification flow", () => {
    expect(CRM_LEAD_WORKFLOW_STATUSES).toEqual([
      "NEW",
      "CONTACTED",
      "QUALIFYING",
      "QUALIFIED",
      "OPPORTUNITY",
      "WON",
      "LOST",
    ]);
  });

  it("allows only valid forward transitions", () => {
    expect(validateWorkflowTransition("NEW", "CONTACTED").valid).toBe(true);
    expect(validateWorkflowTransition("NEW", "QUALIFIED").valid).toBe(false);
    expect(validateWorkflowTransition("QUALIFIED", "OPPORTUNITY").valid).toBe(true);
    expect(validateWorkflowTransition("OPPORTUNITY", "WON").valid).toBe(true);
    expect(validateWorkflowTransition("OPPORTUNITY", "LOST").valid).toBe(true);
    expect(validateWorkflowTransition("WON", "LOST").valid).toBe(false);
  });

  it("returns allowed next statuses", () => {
    expect(getAllowedNextStatuses("QUALIFYING")).toEqual(["QUALIFIED", "LOST"]);
    expect(getAllowedNextStatuses("WON")).toEqual([]);
  });

  it("maps workflow status to qualification and lifecycle states", () => {
    expect(mapWorkflowToQualificationState("QUALIFYING")).toBe("IN_PROGRESS");
    expect(mapWorkflowToQualificationState("QUALIFIED")).toBe("QUALIFIED");
    expect(mapWorkflowToQualificationState("LOST")).toBe("DISQUALIFIED");
    expect(mapWorkflowToLifecycleStage("OPPORTUNITY")).toBe("OPPORTUNITY");
    expect(mapWorkflowToLifecycleStage("WON")).toBe("CUSTOMER");
  });
});

describe("CRM PII safety", () => {
  it("detects PII in URLs", () => {
    expect(containsPiiInUrl("/crm/leads/abc123")).toBe(false);
    expect(containsPiiInUrl("/leads?email=test@example.com")).toBe(true);
    expect(() => assertNoPiiInUrl("/leads?email=test@example.com")).toThrow();
  });

  it("strips PII from activity metadata", () => {
    const safe = sanitiseActivityMetadata({
      previousStatus: "NEW",
      newStatus: "CONTACTED",
      email: "secret@example.com",
      phone: "+1 555 123 4567",
    });
    expect(safe).toEqual({ previousStatus: "NEW", newStatus: "CONTACTED" });
  });

  it("redacts values in restricted logs", () => {
    expect(redactForRestrictedLog("alex@example.com")).toBe("[redacted-email]");
    expect(redactForRestrictedLog("status change")).toBe("status change");
  });

  it("minimises export by scope", () => {
    const full = minimiseCrmLeadExport(
      {
        id: "lead-1",
        status: "QUALIFIED",
        lifecycleStage: "MARKETING_QUALIFIED",
        qualificationState: "QUALIFIED",
        retentionStatus: "ACTIVE",
        displayName: "Alex",
        email: "alex@example.com",
        utmCampaign: "spring",
      },
      "FULL",
    );
    expect(full.email).toBe("alex@example.com");
    expect(full.utmCampaign).toBe("spring");

    const summary = minimiseCrmLeadExport(
      {
        id: "lead-1",
        status: "QUALIFIED",
        lifecycleStage: "MARKETING_QUALIFIED",
        qualificationState: "QUALIFIED",
        retentionStatus: "ACTIVE",
        displayName: "Alex",
        email: "alex@example.com",
      },
      "SUMMARY",
    );
    expect(summary).not.toHaveProperty("email");
    expect(summary).not.toHaveProperty("displayName");
  });

  it("builds anonymisation preview", () => {
    const preview = buildAnonymisationPreview("lead-1");
    expect(preview.leadId).toBe("lead-1");
    expect(preview.retentionStatus).toBe("ANONYMISED");
    expect(preview.requiresAudit).toBe(true);
  });
});

describe("CRM duplicate detection", () => {
  it("flags high-confidence email duplicates for auto-merge", () => {
    const evidence = buildDuplicateEvidence({ email: "Alex@Example.com" });
    expect(canAutoMerge(evidence)).toBe(true);
  });
});

describe("CRM core permissions", () => {
  it("restricts consent management to privileged roles", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["crm.manageConsent"])).toBe(false);
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["crm.manageConsent"])).toBe(true);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["crm.export"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["crm.create"])).toBe(false);
  });
});
