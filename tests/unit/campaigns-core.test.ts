import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { CAMPAIGN_STATUS_TRANSITIONS } from "@/lib/campaigns/constants";
import {
  assertTransition,
  resolveTransitionAction,
} from "@/lib/campaigns/transitions";
import {
  validateActivation,
  validateBudget,
  validateCampaignDates,
  validateReadiness,
} from "@/lib/campaigns/validation";
import {
  canManageCampaignKpis,
  canManageCampaignMembers,
  canTransitionCampaign,
  canUpdateCampaign,
} from "@/lib/campaigns/permissions";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";
import { AppError } from "@/lib/errors";

describe("campaign status transitions", () => {
  it("allows draft to planned", () => {
    expect(CAMPAIGN_STATUS_TRANSITIONS.DRAFT).toContain("PLANNED");
    expect(resolveTransitionAction("plan", "DRAFT")).toBe("PLANNED");
  });

  it("allows ready to active", () => {
    expect(resolveTransitionAction("activate", "READY")).toBe("ACTIVE");
  });

  it("rejects arbitrary transitions", () => {
    expect(() => assertTransition("DRAFT", "ACTIVE")).toThrow(AppError);
  });

  it("rejects activate from draft", () => {
    expect(() => resolveTransitionAction("activate", "DRAFT")).toThrow(AppError);
  });

  it("allows completed to archive", () => {
    expect(resolveTransitionAction("archive", "COMPLETED")).toBe("ARCHIVED");
  });

  it("allows archived restore to draft", () => {
    expect(resolveTransitionAction("restore", "ARCHIVED")).toBe("DRAFT");
  });
});

describe("campaign validation", () => {
  it("rejects end date before start date", () => {
    const issues = validateCampaignDates(new Date("2026-08-10"), new Date("2026-08-01"));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.field).toBe("endAt");
  });

  it("rejects negative budget", () => {
    const issues = validateBudget(-1, "USD");
    expect(issues.some((issue) => issue.field === "budgetAmount")).toBe(true);
  });

  it("requires currency when budget amount is set", () => {
    const issues = validateBudget(100, null);
    expect(issues.some((issue) => issue.field === "budgetCurrency")).toBe(true);
  });

  it("requires channels and KPIs before ready", () => {
    const issues = validateReadiness({
      name: "Launch",
      primaryObjective: "WEBSITE_TRAFFIC",
      startAt: new Date("2026-09-01"),
      endAt: new Date("2026-09-30"),
      channels: [],
      kpis: [{ id: "kpi-1" }],
    });
    expect(issues.some((issue) => issue.field === "channels")).toBe(true);
  });

  it("requires active channel before activation", () => {
    const issues = validateActivation({
      status: "READY",
      channels: [{ status: "CANCELLED" }],
    });
    expect(issues.some((issue) => issue.field === "channels")).toBe(true);
  });
});

describe("campaign permissions", () => {
  it("grants marketers campaign create permission", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["campaign.create"])).toBe(true);
  });

  it("grants viewers read-only campaign access", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["campaign.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["campaign.update"])).toBe(false);
  });

  it("allows contributors to edit assigned campaigns", () => {
    expect(canUpdateCampaign(OrganisationRole.MARKETER, "CONTRIBUTOR")).toBe(true);
  });

  it("restricts viewers on assigned campaigns", () => {
    expect(canUpdateCampaign(OrganisationRole.VIEWER, "VIEWER")).toBe(false);
    expect(canTransitionCampaign(OrganisationRole.VIEWER, "VIEWER")).toBe(false);
  });

  it("allows managers to manage members and KPIs", () => {
    expect(canManageCampaignMembers(OrganisationRole.MARKETER, "MANAGER")).toBe(true);
    expect(canManageCampaignKpis(OrganisationRole.MARKETER, "MANAGER")).toBe(true);
  });
});

describe("version conflict error code", () => {
  it("maps CONFLICT to HTTP 409", () => {
    const error = new AppError("CONFLICT", "CAMPAIGN_VERSION_CONFLICT");
    expect(error.status).toBe(409);
    expect(error.code).toBe("CONFLICT");
  });
});
