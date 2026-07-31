import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";

const infraService = vi.hoisted(() => ({
  listProviders: vi.fn(),
  createProvider: vi.fn(),
  listDomains: vi.fn(),
  listSenders: vi.fn(),
}));
const templateService = vi.hoisted(() => ({ listTemplates: vi.fn(), createTemplate: vi.fn() }));
const messageService = vi.hoisted(() => ({ listMessages: vi.fn(), queueMessage: vi.fn() }));
const suppressionService = vi.hoisted(() => ({ listSuppressions: vi.fn() }));
const deliverabilityService = vi.hoisted(() => ({ getSnapshot: vi.fn(), listSnapshots: vi.fn() }));
const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/email-infrastructure-service", () => ({ emailInfrastructureService: infraService }));
vi.mock("@/server/services/email-template-service", () => ({ emailTemplateService: templateService }));
vi.mock("@/server/services/email-message-service", () => ({ emailMessageService: messageService }));
vi.mock("@/server/services/email-suppression-service", () => ({ emailSuppressionService: suppressionService }));
vi.mock("@/server/services/email-webhook-service", () => ({
  emailDeliverabilityService: deliverabilityService,
  emailWebhookService: { processWebhook: vi.fn() },
}));
vi.mock("@/lib/tenancy/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenancy/guards")>();
  return { ...actual, buildTenantContext };
});
vi.mock("@/lib/auth/provisioning", () => ({
  ensureUserProfile: vi.fn().mockResolvedValue({ authUserId: "test-auth", userProfileId: "profile-1" }),
  extractProviderMetadata: vi.fn().mockReturnValue({}),
}));

import { GET, POST } from "@/app/api/brands/[brandId]/email/route";

const brandId = "brand-email-1";
const organisationId = "org-email-1";
const brandParams = { params: Promise.resolve({ brandId }) };

describe("email routes authorization", () => {
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
    infraService.listProviders.mockResolvedValue([]);
    infraService.listDomains.mockResolvedValue([]);
    infraService.listSenders.mockResolvedValue([]);
    templateService.listTemplates.mockResolvedValue([]);
    messageService.listMessages.mockResolvedValue([]);
    infraService.createProvider.mockResolvedValue({ id: "prov-1" });
    messageService.queueMessage.mockResolvedValue({ id: "msg-1", status: "QUEUED" });
    deliverabilityService.getSnapshot.mockResolvedValue({ snapshot: {}, warnings: [], shutdownRecommended: false });
    deliverabilityService.listSnapshots.mockResolvedValue([]);
  });

  afterEach(() => {
    delete process.env.ALLOW_TEST_AUTH;
    delete process.env.TEST_AUTH_USER_ID;
  });

  it("allows marketers to read email overview", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });
    const response = await GET(
      new NextRequest(`https://app.test/api/brands/${brandId}/email?organisationId=${organisationId}`),
      brandParams,
    );
    expect(response.status).toBe(200);
  });

  it("rejects viewers creating providers", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.VIEWER,
    });
    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/email?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "createProvider", name: "SES", providerType: "AMAZON_SES" }),
      }),
      brandParams,
    );
    expect(response.status).toBe(403);
  });

  it("queues messages for marketers", async () => {
    buildTenantContext.mockResolvedValue({
      userId: "test-auth",
      userProfileId: "profile-1",
      organisationId,
      organisationRole: OrganisationRole.MARKETER,
    });
    const response = await POST(
      new NextRequest(`https://app.test/api/brands/${brandId}/email?organisationId=${organisationId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "queueMessage",
          senderIdentityId: "sender-1",
          category: "ESSENTIAL_TRANSACTIONAL",
          subject: "Test",
          recipients: [{ emailAddress: "user@example.com" }],
          consent: { marketing: false, transactional: true },
        }),
      }),
      brandParams,
    );
    expect(response.status).toBe(200);
    expect(messageService.queueMessage).toHaveBeenCalled();
  });

  it("loads deliverability view", async () => {
    const response = await GET(
      new NextRequest(`https://app.test/api/brands/${brandId}/email?organisationId=${organisationId}&view=deliverability`),
      brandParams,
    );
    expect(response.status).toBe(200);
    expect(deliverabilityService.getSnapshot).toHaveBeenCalled();
  });
});
