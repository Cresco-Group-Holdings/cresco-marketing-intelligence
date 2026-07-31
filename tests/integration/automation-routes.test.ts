import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";

const automationService = vi.hoisted(() => ({
  listAutomations: vi.fn(),
  getAutomation: vi.fn(),
  createAutomation: vi.fn(),
  saveGraph: vi.fn(),
  pauseAutomation: vi.fn(),
}));

const enrollmentService = vi.hoisted(() => ({
  enrollLead: vi.fn(),
  listEnrollments: vi.fn(),
}));

const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/marketing-automation-service", () => ({
  marketingAutomationService: automationService,
}));
vi.mock("@/server/services/marketing-automation-enrollment-service", () => ({
  marketingAutomationEnrollmentService: enrollmentService,
}));
vi.mock("@/lib/tenancy/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenancy/guards")>();
  return { ...actual, buildTenantContext };
});
vi.mock("@/lib/auth/provisioning", () => ({
  ensureUserProfile: vi.fn().mockResolvedValue({ authUserId: "test-auth", userProfileId: "profile-1" }),
  extractProviderMetadata: vi.fn().mockReturnValue({}),
}));

import { GET, POST } from "@/app/api/brands/[brandId]/automation/route";

const brandId = "brand-auto-1";
const organisationId = "org-auto-1";
const brandParams = { params: Promise.resolve({ brandId }) };

describe("automation routes authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOW_TEST_AUTH = "true";
    process.env.TEST_AUTH_USER_ID = "test-auth";
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.OWNER,
    });
    automationService.listAutomations.mockResolvedValue([]);
    automationService.getAutomation.mockResolvedValue({ id: "auto-1", status: "DRAFT" });
    automationService.createAutomation.mockResolvedValue({ id: "auto-1", status: "DRAFT" });
    automationService.saveGraph.mockResolvedValue({ id: "ver-1", versionNumber: 1 });
    automationService.pauseAutomation.mockResolvedValue({ id: "auto-1", status: "PAUSED" });
    enrollmentService.enrollLead.mockResolvedValue({ id: "enr-1", status: "ACTIVE" });
    enrollmentService.listEnrollments.mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.ALLOW_TEST_AUTH;
    delete process.env.TEST_AUTH_USER_ID;
  });

  it("loads automation detail with tenant scoping", async () => {
    const response = await GET(
      new NextRequest(
        `https://app.test/api/brands/${brandId}/automation?organisationId=${organisationId}&automationId=auto-1`,
      ),
      brandParams,
    );
    expect(response.status).toBe(200);
    expect(automationService.getAutomation).toHaveBeenCalledWith(
      "auto-1",
      brandId,
      organisationId,
      expect.anything(),
    );
  });

  it("rejects viewers creating automations", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.VIEWER,
    });
    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/automation?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "createAutomation", name: "Welcome journey" }),
      }),
      brandParams,
    );
    expect(response.status).toBe(403);
    expect(automationService.createAutomation).not.toHaveBeenCalled();
  });

  it("creates automations for marketers", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });
    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/automation?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "createAutomation", name: "Welcome journey" }),
      }),
      brandParams,
    );
    expect(response.status).toBe(200);
    expect(automationService.createAutomation).toHaveBeenCalledWith(
      brandId,
      organisationId,
      expect.objectContaining({ name: "Welcome journey" }),
      expect.anything(),
    );
  });

  it("saves graph for editors", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });
    const graphPayload = {
      action: "saveGraph",
      automationId: "auto-1",
      nodes: [
        { nodeKey: "trigger", nodeType: "TRIGGER" },
        { nodeKey: "end", nodeType: "END" },
      ],
      edges: [{ sourceNodeKey: "trigger", targetNodeKey: "end" }],
      triggers: [{ triggerType: "LEAD_CREATED", config: {} }],
      exitRules: [],
    };
    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/automation?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(graphPayload),
      }),
      brandParams,
    );
    expect(response.status).toBe(200);
    expect(automationService.saveGraph).toHaveBeenCalledWith(
      "auto-1",
      brandId,
      organisationId,
      expect.objectContaining({ action: "saveGraph" }),
      expect.anything(),
    );
  });

  it("enrolls leads for authorised users", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });
    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/automation?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "enrollLead", automationId: "auto-1", leadId: "lead-1" }),
      }),
      brandParams,
    );
    expect(response.status).toBe(200);
    expect(enrollmentService.enrollLead).toHaveBeenCalledWith(
      "auto-1",
      brandId,
      organisationId,
      expect.objectContaining({ leadId: "lead-1" }),
      expect.anything(),
    );
  });

  it("pauses automations for authorised users", async () => {
    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/automation?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "pauseAutomation", automationId: "auto-1" }),
      }),
      brandParams,
    );
    expect(response.status).toBe(200);
    expect(automationService.pauseAutomation).toHaveBeenCalledWith(
      "auto-1",
      brandId,
      organisationId,
      expect.anything(),
    );
  });

  it("rejects viewers pausing automations", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.VIEWER,
    });
    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/automation?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "pauseAutomation", automationId: "auto-1" }),
      }),
      brandParams,
    );
    expect(response.status).toBe(403);
    expect(automationService.pauseAutomation).not.toHaveBeenCalled();
  });
});
