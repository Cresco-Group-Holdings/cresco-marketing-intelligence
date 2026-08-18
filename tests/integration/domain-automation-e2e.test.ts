import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  domainEventOutbox: {
    findUnique: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/automation-engine-execution-service", () => ({
  automationEngineExecutionService: {
    dispatchEvent: vi.fn().mockResolvedValue({ results: [{ status: "COMPLETED" }] }),
  },
}));
vi.mock("@/server/services/marketing-automation-enrollment-service", () => ({
  marketingAutomationEnrollmentService: {
    processTriggerEvent: vi.fn().mockResolvedValue({ enrolled: [], skipped: [] }),
  },
}));

import { DOMAIN_EVENT_TYPES } from "@/lib/domain-events/constants";
import { domainEventService } from "@/server/services/domain-event-service";
import { automationEngineExecutionService } from "@/server/services/automation-engine-execution-service";

describe("domain automation E2E scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.domainEventOutbox.findUnique.mockResolvedValue(null);
    prismaMock.domainEventOutbox.create.mockResolvedValue({ id: "outbox-1" });
    prismaMock.domainEventOutbox.findMany.mockResolvedValue([
      {
        id: "outbox-1",
        eventType: DOMAIN_EVENT_TYPES.PUBLICATION_FAILED,
        resourceType: "PublishingJob",
        resourceId: "job-1",
        payload: { provider: "INSTAGRAM", safeError: "Token expired" },
        idempotencyKey: "domain:publishing-failed:job-1:1",
        correlationId: null,
        causationId: null,
        occurredAt: new Date(),
      },
    ]);
    prismaMock.domainEventOutbox.update.mockResolvedValue({});
  });

  it("scenario A: publication failure emits domain event and dispatches automation", async () => {
    const result = await domainEventService.emit({
      type: DOMAIN_EVENT_TYPES.PUBLICATION_FAILED,
      organisationId: "org-1",
      projectId: "project-1",
      brandId: "brand-1",
      resourceType: "PublishingJob",
      resourceId: "job-1",
      payload: { provider: "INSTAGRAM", safeError: "Token expired" },
      idempotencyKey: "domain:publishing-failed:job-1:1",
    });

    expect(result.dispatched).toBe(true);
    expect(result.automationEventType).toBe("PUBLICATION_FAILED");
    expect(prismaMock.domainEventOutbox.create).toHaveBeenCalled();
  });

  it("scenario D: duplicate domain event is not re-inserted", async () => {
    prismaMock.domainEventOutbox.findUnique.mockResolvedValue({
      id: "existing",
      status: "PROCESSED",
    });

    const result = await domainEventService.emit({
      type: DOMAIN_EVENT_TYPES.PUBLICATION_FAILED,
      organisationId: "org-1",
      brandId: "brand-1",
      resourceType: "PublishingJob",
      resourceId: "job-1",
      payload: {},
      idempotencyKey: "domain:publishing-failed:job-1:1",
    });

    expect(prismaMock.domainEventOutbox.create).not.toHaveBeenCalled();
    expect(result.dispatched).toBe(false);
  });

  it("scenario A worker: processes pending publication failure into automation dispatch", async () => {
    const processed = await domainEventService.processPendingForBrand("brand-1", "org-1");
    expect(processed.processed).toBe(1);
    expect(automationEngineExecutionService.dispatchEvent).toHaveBeenCalledWith(
      "brand-1",
      "org-1",
      expect.objectContaining({
        eventType: "PUBLICATION_FAILED",
        idempotencyKey: "domain:publishing-failed:job-1:1",
      }),
      expect.any(Object),
    );
  });
});
