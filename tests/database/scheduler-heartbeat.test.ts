import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTenant,
  databaseSuiteEnabled,
  prisma,
  resetDatabase,
} from "./helpers/analytics-fixtures";
import { schedulerHealthService } from "@/server/services/scheduler-health-service";

const suite = databaseSuiteEnabled ? describe : describe.skip;

suite("SchedulerHeartbeat migration and persistence", () => {
  const FIXED_NOW = new Date("2026-07-15T12:00:00.000Z");

  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach(async () => {
    await prisma.$executeRaw`DELETE FROM "SchedulerHeartbeat"`;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("persists dispatch heartbeat with job counters", async () => {
    await createTenant();

    await schedulerHealthService.recordDispatch({
      discovered: 4,
      created: 2,
      activated: 1,
      skipped: 1,
    });

    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        invocationType: string;
        jobsDiscovered: number;
        jobsCreated: number;
        jobsActivated: number;
        lastSucceededAt: Date | null;
      }>
    >`SELECT "id", "invocationType", "jobsDiscovered", "jobsCreated", "jobsActivated", "lastSucceededAt"
      FROM "SchedulerHeartbeat" WHERE "id" = 'global'`;

    expect(rows).toHaveLength(1);
    expect(rows[0]?.invocationType).toBe("dispatch");
    expect(rows[0]?.jobsDiscovered).toBe(4);
    expect(rows[0]?.jobsCreated).toBe(2);
    expect(rows[0]?.jobsActivated).toBe(1);
    expect(rows[0]?.lastSucceededAt).not.toBeNull();
  });

  it("records process heartbeat and flags missed heartbeat after threshold", async () => {
    await createTenant();

    const stale = new Date(FIXED_NOW.getTime() - 20 * 60_000);
    await prisma.$executeRaw`
      INSERT INTO "SchedulerHeartbeat" (
        "id", "lastInvokedAt", "lastSucceededAt", "invocationType",
        "jobsDiscovered", "jobsCreated", "jobsActivated", "jobsClaimed", "jobsSucceeded",
        "updatedAt"
      ) VALUES (
        'global', ${stale}, ${stale}, 'dispatch',
        1, 0, 0, 0, 0,
        ${stale}
      )
    `;

    const health = await schedulerHealthService.getHealth(FIXED_NOW);
    expect(health.missedHeartbeat).toBe(true);
    expect(health.lagMs).toBeGreaterThan(15 * 60_000);

    await schedulerHealthService.recordProcess({
      claimed: 1,
      succeeded: 1,
      failed: 0,
      retrying: 0,
    });

    const recovered = await schedulerHealthService.getHealth(new Date());
    expect(recovered.missedHeartbeat).toBe(false);
    expect(recovered.heartbeat?.jobsClaimed).toBe(1);
    expect(recovered.heartbeat?.jobsSucceeded).toBe(1);
  });
});
