import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import type { TenantContext } from "@/lib/tenancy/context";
import type { AIProvider } from "@/lib/ai/types";
import { setAIProviderForTests, resetAIProvidersForTests } from "@/lib/ai/providers";
import { resetTenantRateLimiterForTests } from "@/lib/ai/rate-limit";

const tenantContext: TenantContext = {
  userId: "auth-user-1",
  userProfileId: "profile-1",
  organisationId: "org-1",
  organisationRole: OrganisationRole.OWNER,
};

const prismaMock = vi.hoisted(() => ({
  promptTemplate: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  aIRequest: {
    create: vi.fn(),
    update: vi.fn(),
  },
  aIExecution: {
    create: vi.fn(),
    update: vi.fn(),
  },
  aIUsageRecord: {
    create: vi.fn(),
    aggregate: vi.fn(),
  },
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/server/services/prompt-template-service", () => ({
  promptTemplateService: {
    getActiveTemplate: vi.fn(),
  },
}));

vi.mock("@/server/services/ai-usage-recorder", () => ({
  aiUsageRecorder: { record: vi.fn() },
}));

import { aiRequestService } from "@/server/services/ai-request-service";
import { promptTemplateService } from "@/server/services/prompt-template-service";

describe("aiRequestService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAIProvidersForTests();
    resetTenantRateLimiterForTests();

    vi.mocked(promptTemplateService.getActiveTemplate).mockResolvedValue({
      id: "template-1",
      key: "diagnostics.ping",
      name: "Diagnostics",
      description: null,
      purpose: "DIAGNOSTICS_TEST",
      organisationId: null,
      activeVersionId: "version-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      activeVersion: {
        id: "version-1",
        promptTemplateId: "template-1",
        version: 1,
        systemPrompt: "Diagnostics system prompt",
        outputSchemaKey: "diagnostics.ping",
        status: "ACTIVE",
        createdByUserId: null,
        createdAt: new Date(),
      },
    } as never);

    prismaMock.aIUsageRecord.aggregate.mockResolvedValue({ _sum: { totalTokens: 0 } });
    prismaMock.aIRequest.create.mockResolvedValue({ id: "request-1" });
    prismaMock.aIRequest.update.mockResolvedValue({});
    prismaMock.aIExecution.create.mockResolvedValue({ id: "execution-1" });
    prismaMock.aIExecution.update.mockResolvedValue({});
  });

  it("executes text requests through the provider abstraction", async () => {
    const provider: AIProvider = {
      name: "MOCK",
      isConfigured: () => true,
      generateText: vi.fn().mockResolvedValue({
        content: "ok",
        usage: { promptTokens: 5, completionTokens: 3, totalTokens: 8 },
        model: "mock-text-v1",
        provider: "MOCK",
        latencyMs: 12,
      }),
      generateStructured: vi.fn(),
    };
    setAIProviderForTests("MOCK", provider);

    const result = await aiRequestService.executeText(
      {
        organisationId: "org-1",
        userProfileId: "profile-1",
        purpose: "DIAGNOSTICS_TEST",
        templateKey: "diagnostics.ping",
        userInput: "ping",
      },
      tenantContext,
    );

    expect(result.output).toBe("ok");
    expect(provider.generateText).toHaveBeenCalled();
    expect(prismaMock.aIRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ organisationId: "org-1", purpose: "DIAGNOSTICS_TEST" }),
      }),
    );
  });

  it("rejects cross-tenant execution", async () => {
    await expect(
      aiRequestService.executeText(
        {
          organisationId: "org-2",
          userProfileId: "profile-1",
          purpose: "DIAGNOSTICS_TEST",
          templateKey: "diagnostics.ping",
          userInput: "ping",
        },
        tenantContext,
      ),
    ).rejects.toThrow(/Cross-organisation access is not permitted/);
  });

  it("falls back when provider errors are not retryable", async () => {
    const provider: AIProvider = {
      name: "MOCK",
      isConfigured: () => true,
      generateText: vi.fn().mockRejectedValue({
        category: "CONFIGURATION_ERROR",
        message: "not configured",
        retryable: false,
      }),
      generateStructured: vi.fn(),
    };
    setAIProviderForTests("MOCK", provider);

    await expect(
      aiRequestService.executeText(
        {
          organisationId: "org-1",
          userProfileId: "profile-1",
          purpose: "DIAGNOSTICS_TEST",
          templateKey: "diagnostics.ping",
          userInput: "ping",
        },
        tenantContext,
      ),
    ).rejects.toThrow();
  });
});
