import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";

const leadScoringService = vi.hoisted(() => ({
  listModels: vi.fn(),
  getModel: vi.fn(),
  createModel: vi.fn(),
  scoreLead: vi.fn(),
}));

const leadQualificationModelService = vi.hoisted(() => ({
  applyOverride: vi.fn(),
}));

const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/lead-scoring-service", () => ({ leadScoringService }));
vi.mock("@/server/services/lead-qualification-model-service", () => ({ leadQualificationModelService }));
vi.mock("@/server/services/lead-scoring-simulation-service", () => ({
  leadScoringSimulationService: { runSimulation: vi.fn(), getSimulation: vi.fn(), approveSimulation: vi.fn() },
}));
vi.mock("@/lib/tenancy/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenancy/guards")>();
  return { ...actual, buildTenantContext };
});
vi.mock("@/lib/auth/provisioning", () => ({
  ensureUserProfile: vi.fn().mockResolvedValue({
    authUserId: "test-auth-user",
    userProfileId: "profile-1",
  }),
  extractProviderMetadata: vi.fn().mockReturnValue({}),
}));

import { GET, POST } from "@/app/api/brands/[brandId]/crm/scoring/route";

const brandId = "brand-scoring-1";
const organisationId = "org-scoring-1";
const brandParams = { params: Promise.resolve({ brandId }) };

describe("lead scoring routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOW_TEST_AUTH = "true";
    process.env.TEST_AUTH_USER_ID = "test-auth-user";
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.OWNER,
    });
    leadScoringService.listModels.mockResolvedValue([]);
    leadScoringService.getModel.mockResolvedValue({
      id: "model-1",
      name: "ICP model",
      status: "DRAFT",
      brandId,
      organisationId,
    });
    leadScoringService.createModel.mockResolvedValue({
      id: "model-new",
      name: "ICP model",
      status: "DRAFT",
      brandId,
      organisationId,
    });
    leadScoringService.scoreLead.mockResolvedValue({
      leadId: "lead-1",
      modelId: "model-1",
      combinedScore: 55,
      qualificationStatus: "SALES_QUALIFIED",
    });
    leadQualificationModelService.applyOverride.mockResolvedValue({
      id: "override-1",
      resultId: "result-1",
      previousStatus: "MARKETING_QUALIFIED",
      newStatus: "SALES_QUALIFIED",
      reason: "Sales confirmed fit",
    });
  });

  afterEach(() => {
    delete process.env.ALLOW_TEST_AUTH;
    delete process.env.TEST_AUTH_USER_ID;
  });

  it("scopes model reads to brand and organisation (tenant isolation)", async () => {
    const response = await GET(
      new NextRequest(
        `https://app.test/api/brands/${brandId}/crm/scoring?organisationId=${organisationId}&modelId=model-1`,
      ),
      brandParams,
    );

    expect(response.status).toBe(200);
    expect(leadScoringService.getModel).toHaveBeenCalledWith(
      "model-1",
      brandId,
      organisationId,
      expect.objectContaining({ organisationId }),
    );
  });

  it("creates scoring models for authorised marketers", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });

    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm/scoring?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "createModel", name: "ICP model" }),
      }),
      brandParams,
    );

    expect(response.status).toBe(200);
    expect(leadScoringService.createModel).toHaveBeenCalledWith(
      brandId,
      organisationId,
      expect.objectContaining({ name: "ICP model" }),
      expect.anything(),
    );
  });

  it("scores a lead against a model with tenant context", async () => {
    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm/scoring?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "scoreLead", modelId: "model-1", leadId: "lead-1" }),
      }),
      brandParams,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.snapshot.combinedScore).toBe(55);
    expect(leadScoringService.scoreLead).toHaveBeenCalledWith(
      "model-1",
      brandId,
      organisationId,
      expect.objectContaining({ leadId: "lead-1" }),
      expect.objectContaining({ organisationId }),
    );
  });

  it("records qualification overrides for authorised users", async () => {
    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm/scoring?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "applyOverride",
          qualificationModelId: "qual-model-1",
          leadId: "lead-1",
          newStatus: "SALES_QUALIFIED",
          reason: "Sales confirmed fit",
        }),
      }),
      brandParams,
    );

    expect(response.status).toBe(200);
    expect(leadQualificationModelService.applyOverride).toHaveBeenCalledWith(
      "qual-model-1",
      brandId,
      organisationId,
      expect.objectContaining({ newStatus: "SALES_QUALIFIED", leadId: "lead-1" }),
      expect.anything(),
    );
  });

  it("rejects viewers creating models", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.VIEWER,
    });

    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm/scoring?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "createModel", name: "ICP model" }),
      }),
      brandParams,
    );

    expect(response.status).toBe(403);
    expect(leadScoringService.createModel).not.toHaveBeenCalled();
  });

  it("rejects viewers overriding qualification", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth-user",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.VIEWER,
    });

    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm/scoring?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "applyOverride",
          qualificationModelId: "qual-model-1",
          leadId: "lead-1",
          newStatus: "SALES_QUALIFIED",
        }),
      }),
      brandParams,
    );

    expect(response.status).toBe(403);
    expect(leadQualificationModelService.applyOverride).not.toHaveBeenCalled();
  });
});
