import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTenant,
  databaseSuiteEnabled,
  prisma,
  resetDatabase,
} from "./helpers/analytics-fixtures";
import { usageReservationService } from "@/lib/billing/usage-reservation";

const suite = databaseSuiteEnabled ? describe : describe.skip;

suite("usage reservation PostgreSQL concurrency", () => {
  let tenant: Awaited<ReturnType<typeof createTenant>>;

  beforeEach(async () => {
    await resetDatabase();
    tenant = await createTenant();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("prevents concurrent reservations from exceeding allowance", async () => {
    const organisationId = tenant.organisation.id;
    const meterKey = "ai.tokens";

    const first = usageReservationService.reserve({
      organisationId,
      meterKey,
      amount: 60,
      idempotencyKey: "reserve-concurrency-1",
      allowance: 100,
      period: "LIFETIME",
    });

    const second = usageReservationService.reserve({
      organisationId,
      meterKey,
      amount: 60,
      idempotencyKey: "reserve-concurrency-2",
      allowance: 100,
      period: "LIFETIME",
    });

    const results = await Promise.allSettled([first, second]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: "PLAN_LIMIT_EXCEEDED",
    });
  });

  it("deduplicates reservation by idempotency key", async () => {
    const organisationId = tenant.organisation.id;
    const first = await usageReservationService.reserve({
      organisationId,
      meterKey: "ai.tokens",
      amount: 10,
      idempotencyKey: "reserve-dup-db",
      allowance: 100,
      period: "LIFETIME",
    });
    const second = await usageReservationService.reserve({
      organisationId,
      meterKey: "ai.tokens",
      amount: 10,
      idempotencyKey: "reserve-dup-db",
      allowance: 100,
      period: "LIFETIME",
    });

    expect(first.reserved).toBe(true);
    expect(second.duplicate).toBe(true);
  });

  it("releases reservation without counting committed usage", async () => {
    const organisationId = tenant.organisation.id;
    await usageReservationService.reserve({
      organisationId,
      meterKey: "ai.tokens",
      amount: 40,
      idempotencyKey: "reserve-release-db",
      allowance: 100,
      period: "LIFETIME",
    });

    const released = await usageReservationService.release({
      organisationId,
      reservationIdempotencyKey: "reserve-release-db",
    });
    expect(released.released).toBe(true);

    const reserved = await usageReservationService.getReservedUsage(
      organisationId,
      "ai.tokens",
      "LIFETIME",
    );
    expect(reserved).toBe(0);
  });
});
