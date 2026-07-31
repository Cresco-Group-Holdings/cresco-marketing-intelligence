import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";

const taskService = vi.hoisted(() => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
  completeTask: vi.fn(),
  syncOverdueTasks: vi.fn(),
}));
const activityService = vi.hoisted(() => ({
  listActivities: vi.fn(),
  logActivity: vi.fn(),
}));
const followUpService = vi.hoisted(() => ({
  listRules: vi.fn(),
  listSuggestions: vi.fn(),
  evaluateRules: vi.fn(),
  generateAiSuggestion: vi.fn(),
}));
const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/crm-task-service", () => ({ crmTaskService: taskService }));
vi.mock("@/server/services/crm-activity-service", () => ({ crmActivityService: activityService }));
vi.mock("@/server/services/crm-follow-up-service", () => ({ crmFollowUpService: followUpService }));
vi.mock("@/lib/tenancy/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenancy/guards")>();
  return { ...actual, buildTenantContext };
});
vi.mock("@/lib/auth/provisioning", () => ({
  ensureUserProfile: vi.fn().mockResolvedValue({ authUserId: "test-auth", userProfileId: "profile-1" }),
  extractProviderMetadata: vi.fn().mockReturnValue({}),
}));

import { GET, POST } from "@/app/api/brands/[brandId]/crm/tasks/route";

const brandId = "brand-task-1";
const organisationId = "org-task-1";
const brandParams = { params: Promise.resolve({ brandId }) };

describe("crm tasks routes authorization", () => {
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
    taskService.listTasks.mockResolvedValue([]);
    taskService.createTask.mockResolvedValue({ id: "task-1", title: "Follow up", status: "OPEN" });
    taskService.completeTask.mockResolvedValue({ id: "task-1", status: "COMPLETED" });
    taskService.syncOverdueTasks.mockResolvedValue({ updated: 1 });
    activityService.listActivities.mockResolvedValue([]);
    activityService.logActivity.mockResolvedValue({ id: "act-1" });
    followUpService.listRules.mockResolvedValue([]);
    followUpService.listSuggestions.mockResolvedValue([]);
    followUpService.evaluateRules.mockResolvedValue({ candidates: [], suggestions: [] });
    followUpService.generateAiSuggestion.mockResolvedValue({ id: "sug-1", autoSendBlocked: true });
  });

  afterEach(() => {
    delete process.env.ALLOW_TEST_AUTH;
    delete process.env.TEST_AUTH_USER_ID;
  });

  it("allows marketers to read tasks", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });
    const response = await GET(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm/tasks?organisationId=${organisationId}`),
      brandParams,
    );
    expect(response.status).toBe(200);
  });

  it("rejects viewers creating tasks", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.VIEWER,
    });
    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm/tasks?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "createTask", title: "Call lead" }),
      }),
      brandParams,
    );
    expect(response.status).toBe(403);
  });

  it("creates tasks for marketers", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });
    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm/tasks?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "createTask", title: "Call lead", taskTypeCode: "CALL" }),
      }),
      brandParams,
    );
    expect(response.status).toBe(200);
    expect(taskService.createTask).toHaveBeenCalled();
  });

  it("loads overdue view", async () => {
    const response = await GET(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm/tasks?organisationId=${organisationId}&view=overdue`),
      brandParams,
    );
    expect(response.status).toBe(200);
    expect(taskService.syncOverdueTasks).toHaveBeenCalled();
  });

  it("blocks viewers from AI generation", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.VIEWER,
    });
    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/crm/tasks?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "generateAiSuggestion", consentGranted: true, leadId: "l1" }),
      }),
      brandParams,
    );
    expect(response.status).toBe(403);
  });
});
