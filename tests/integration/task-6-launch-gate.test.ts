import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTenant,
  databaseSuiteEnabled,
  prisma,
  resetDatabase,
} from "../database/helpers/analytics-fixtures";
import { setClockForTests } from "@/lib/workers/clock";
import { scheduleLocalDateTime } from "@/lib/background/scheduling";

const suite = databaseSuiteEnabled ? describe : describe.skip;

suite("Task 6.1 launch gate — background operations", () => {
  const FIXED_NOW = new Date("2026-07-15T12:00:00.000Z");

  beforeEach(async () => {
    setClockForTests({ now: () => FIXED_NOW, random: () => 0 });
    await resetDatabase();
  });

  afterEach(() => {
    setClockForTests(null);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("deduplicates publication worker jobs across overlapping dispatcher invocations", async () => {
    const tenant = await createTenant();
    const connection = await prisma.providerConnection.create({
      data: {
        organisationId: tenant.organisation.id,
        projectId: tenant.project.id,
        brandId: tenant.brand.id,
        providerKey: "linkedin",
        category: "SOCIAL",
        authType: "OAUTH2_AUTHORIZATION_CODE",
        status: "CONNECTED",
      },
    });

    const publication = await prisma.publication.create({
      data: {
        organisationId: tenant.organisation.id,
        projectId: tenant.project.id,
        brandId: tenant.brand.id,
        contentItemId: tenant.contentItem.id,
        connectionId: connection.id,
        providerKey: "linkedin",
        externalAccountId: "acct-1",
        destinationType: "PAGE",
        destinationId: "page-1",
        operationType: "SOCIAL_PUBLISH_POST",
        status: "SCHEDULED",
        scheduledFor: new Date(FIXED_NOW.getTime() - 60_000),
        timezone: "Europe/London",
        idempotencyKey: `pub-${tenant.brand.id}:launch-gate`,
        requestedByUserId: tenant.user.id,
      },
    });

    const { workerDispatcherService } = await import("@/server/services/worker-dispatcher-service");
    const first = await workerDispatcherService.dispatchDueJobs({ now: FIXED_NOW, jobTypes: ["PUBLISHING"] });
    const second = await workerDispatcherService.dispatchDueJobs({ now: FIXED_NOW, jobTypes: ["PUBLISHING"] });

    expect(first.created + first.skipped).toBeGreaterThan(0);
    expect(second.skipped).toBeGreaterThanOrEqual(1);

    const jobs = await prisma.workerJob.findMany({
      where: {
        organisationId: tenant.organisation.id,
        domainRefId: publication.id,
      },
    });
    expect(jobs).toHaveLength(1);
  });

  it("prevents tenant B from retrying tenant A worker job", async () => {
    const tenantA = await createTenant();
    const tenantB = await createTenant();

    const { workerJobService } = await import("@/server/services/worker-job-service");
    const { job } = await workerJobService.createOrGet({
      organisationId: tenantA.organisation.id,
      jobType: "PUBLISHING",
      domainRefType: "publication",
      domainRefId: "pub-tenant-a",
      idempotencyKey: "tenant-a:publication:pub-tenant-a",
      dueAt: FIXED_NOW,
    });

    await expect(
      workerJobService.requeueForManualRetry(job.id, tenantB.organisation.id),
    ).rejects.toThrow();
  });

  it("does not dispatch publications scheduled in the future", async () => {
    const tenant = await createTenant();
    const connection = await prisma.providerConnection.create({
      data: {
        organisationId: tenant.organisation.id,
        projectId: tenant.project.id,
        brandId: tenant.brand.id,
        providerKey: "linkedin",
        category: "SOCIAL",
        authType: "OAUTH2_AUTHORIZATION_CODE",
        status: "CONNECTED",
      },
    });

    await prisma.publication.create({
      data: {
        organisationId: tenant.organisation.id,
        projectId: tenant.project.id,
        brandId: tenant.brand.id,
        contentItemId: tenant.contentItem.id,
        connectionId: connection.id,
        providerKey: "linkedin",
        externalAccountId: "acct-future",
        destinationType: "PAGE",
        destinationId: "page-1",
        operationType: "SOCIAL_PUBLISH_POST",
        status: "SCHEDULED",
        scheduledFor: new Date(FIXED_NOW.getTime() + 10 * 60_000),
        timezone: "Europe/London",
        idempotencyKey: `pub-${tenant.brand.id}:future`,
        requestedByUserId: tenant.user.id,
      },
    });

    const { discoverPublishingDueWork } = await import(
      "@/server/services/worker-due-providers/publishing-due-provider"
    );
    const due = await discoverPublishingDueWork(FIXED_NOW, 10);
    expect(due).toHaveLength(0);
  });

  it("maps Europe/London local schedule to UTC dueAt within dispatcher window", () => {
    const scheduled = scheduleLocalDateTime({
      localDate: "2026-07-15",
      localTime: "09:30",
      timezone: "Europe/London",
    });
    expect(scheduled.utc.toISOString()).toBe("2026-07-15T08:30:00.000Z");
    const windowStart = new Date("2026-07-15T08:25:00.000Z");
    const windowEnd = new Date("2026-07-15T08:40:00.000Z");
    expect(scheduled.utc >= windowStart && scheduled.utc <= windowEnd).toBe(true);
  });
});
