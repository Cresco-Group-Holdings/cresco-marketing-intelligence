import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { TenantContext } from "@/lib/tenancy/context";
import { OrganisationRole } from "@prisma/client";

const mockListDefinitions = vi.fn();
const mockListRuns = vi.fn();
const mockRunAgent = vi.fn();

vi.mock("@/server/services/agent-platform-service", () => ({
  agentPlatformService: {
    listAgentDefinitions: (...args: unknown[]) => mockListDefinitions(...args),
    listRuns: (...args: unknown[]) => mockListRuns(...args),
    runAgent: (...args: unknown[]) => mockRunAgent(...args),
  },
}));

vi.mock("@/lib/agent-platform/tool-registry", () => ({
  AGENT_TOOL_DEFINITIONS: [{ key: "get_analytics_metrics", readOnly: true }],
}));

vi.mock("@/lib/agent-platform/capability-registry", () => ({
  listAgentCapableModels: () => [{ modelId: "mock-text-v1", available: true }],
}));

vi.mock("@/lib/agent-platform/quotas", () => ({
  getAgentQuotaSummary: async () => ({ runsRemaining: 10 }),
}));

vi.mock("@/lib/agent-platform/agent-registry", () => ({
  listAgentDefinitions: () => [{ key: "marketing_analyst", name: "Marketing Analyst" }],
}));

vi.mock("@/lib/api/handler", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    withApiHandler: (
      _request: NextRequest,
      handler: (ctx: { requestId: string; tenant: TenantContext; user: { userProfileId: string } }) => unknown,
    ) =>
      handler({
        requestId: "req-test",
        tenant: {
          organisationId: "org-1",
          userId: "auth-1",
          userProfileId: "user-1",
          organisationRole: OrganisationRole.OWNER,
        },
        user: { userProfileId: "user-1" },
      }),
  };
});

describe("agent definitions route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns registry payload", async () => {
    const { GET } = await import("@/app/api/agents/definitions/route");
    const request = new NextRequest("http://localhost/api/agents/definitions?organisationId=org-1");
    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});

describe("agent runs route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListRuns.mockResolvedValue([]);
    mockRunAgent.mockResolvedValue({ id: "run-1", status: "COMPLETED" });
  });

  it("accepts agent run requests", async () => {
    const { POST } = await import("@/app/api/agents/runs/route");
    const request = new NextRequest("http://localhost/api/agents/runs?organisationId=org-1", {
      method: "POST",
      body: JSON.stringify({
        agentKey: "marketing_analyst",
        userInput: "Explain performance trends.",
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockRunAgent).toHaveBeenCalled();
  });
});
