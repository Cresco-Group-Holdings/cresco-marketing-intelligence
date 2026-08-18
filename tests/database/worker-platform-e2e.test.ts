import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTenant,
  databaseSuiteEnabled,
  prisma,
  resetDatabase,
} from "./helpers/analytics-fixtures";
import { setClockForTests } from "@/lib/workers/clock";

const suite = databaseSuiteEnabled ? describe : describe.skip;
const FIXED_NOW = new Date("2026-07-15T12:00:00.000Z");

suite("worker job platform database", () => {
  beforeEach(async () => {
    setClockForTests({
      now: () => FIXED_NOW,
      random: () => 0,
    });
    await resetDatabase();
  });

  afterEach(() => {
    setClockForTests(null);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("deduplicates jobs by idempotency key", async () => {
    const tenant = await createTenant();
    const { workerJobService } = await import("@/server/services/worker-job-service");

    const item = {
      organisationId: tenant.organisation.id,
      jobType: "TOKEN_REFRESH" as const,
      domainRefType: "providerConnection",
      domainRefId: "conn-test",
      idempotencyKey: "connection:conn-test:refresh:window",
      dueAt: FIXED_NOW,
    };

    const first = await workerJobService.createOrGet(item);
    const second = await workerJobService.createOrGet(item);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(first.job.id).toBe(second.job.id);

    const count = await prisma.workerJob.count({
      where: { idempotencyKey: item.idempotencyKey },
    });
    expect(count).toBe(1);
  });

  it("allows only one worker to claim the same job", async () => {
    const tenant = await createTenant();
    const { workerJobService } = await import("@/server/services/worker-job-service");

    await workerJobService.createOrGet({
      organisationId: tenant.organisation.id,
      jobType: "PUBLISHING",
      domainRefType: "publication",
      domainRefId: "pub-1",
      idempotencyKey: "publication:pub-1:publish",
      dueAt: FIXED_NOW,
    });

    const [workerA, workerB] = await Promise.all([
      workerJobService.claimDueJobs({ limit: 1, workerId: "worker-a", now: FIXED_NOW }),
      workerJobService.claimDueJobs({ limit: 1, workerId: "worker-b", now: FIXED_NOW }),
    ]);

    const claimedIds = [...workerA, ...workerB].map((job) => job.id);
    expect(new Set(claimedIds).size).toBe(claimedIds.length);
    expect(claimedIds.length).toBe(1);
  });

  it("recovers expired running leases into retry wait", async () => {
    const tenant = await createTenant();
    const { workerJobService } = await import("@/server/services/worker-job-service");

    const { job } = await workerJobService.createOrGet({
      organisationId: tenant.organisation.id,
      jobType: "SEO_CRAWL",
      domainRefType: "seoCrawlRun",
      domainRefId: "run-1",
      idempotencyKey: "seo-crawl:run-1:run",
      dueAt: FIXED_NOW,
    });

    await prisma.workerJob.update({
      where: { id: job.id },
      data: {
        status: "RUNNING",
        claimedBy: "dead-worker",
        leaseExpiresAt: new Date(FIXED_NOW.getTime() - 60_000),
        attemptCount: 1,
      },
    });

    const recovered = await workerJobService.recoverExpiredJobs(FIXED_NOW);
    expect(recovered).toBe(1);

    const updated = await prisma.workerJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(updated.status).toBe("RETRY_WAIT");
    expect(updated.claimedBy).toBeNull();
  });
});
