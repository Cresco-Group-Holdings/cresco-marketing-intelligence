import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  usageRecord: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/billing-account-service", () => ({
  billingAccountService: {
    getAccount: vi.fn().mockResolvedValue({
      subscription: {
        currentPeriodStart: new Date("2026-08-01"),
        currentPeriodEnd: new Date("2026-09-01"),
      },
    }),
  },
}));

import { usageReservationService } from "@/lib/billing/usage-reservation";

const organisationId = "org-reserve-1";
const meterKey = "ai.tokens";

describe("usageReservationService concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.usageRecord.findUnique.mockResolvedValue(null);
    prismaMock.$executeRaw.mockResolvedValue(1);
  });

  it("rejects concurrent reservations that exceed allowance", async () => {
    let activeAmount = 0;
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => {
      const tx = {
        ...prismaMock,
        usageRecord: {
          ...prismaMock.usageRecord,
          findMany: vi.fn().mockImplementation(async () =>
            activeAmount > 0
              ? [{ amount: activeAmount, metadata: { reservationStatus: "active", expiresAt: new Date(Date.now() + 60_000).toISOString() } }]
              : [],
          ),
          create: vi.fn().mockImplementation(async ({ data }: { data: { amount: number } }) => {
            if (activeAmount + data.amount > 100) {
              const error = new Error("Plan usage limit reached.");
              (error as Error & { code: string }).code = "PLAN_LIMIT_EXCEEDED";
              throw error;
            }
            activeAmount += data.amount;
            return { id: `res-${activeAmount}` };
          }),
          update: vi.fn(),
        },
        $executeRaw: prismaMock.$executeRaw,
      };
      return fn(tx);
    });

    const first = await usageReservationService.reserve({
      organisationId,
      meterKey,
      amount: 60,
      idempotencyKey: "reserve-1",
      allowance: 100,
    });

    await expect(
      usageReservationService.reserve({
        organisationId,
        meterKey,
        amount: 60,
        idempotencyKey: "reserve-2",
        allowance: 100,
      }),
    ).rejects.toMatchObject({ code: "PLAN_LIMIT_EXCEEDED" });

    expect(first.reserved).toBe(true);
  });

  it("deduplicates reservation by idempotency key", async () => {
    prismaMock.usageRecord.findUnique.mockResolvedValue({
      id: "existing",
      metadata: { reservationStatus: "active", expiresAt: new Date(Date.now() + 60_000).toISOString() },
    });

    const result = await usageReservationService.reserve({
      organisationId,
      meterKey,
      amount: 10,
      idempotencyKey: "reserve-dup",
      allowance: 100,
    });

    expect(result.duplicate).toBe(true);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("releases reservation on failure without counting usage", async () => {
    prismaMock.usageRecord.findUnique.mockResolvedValue({
      id: "res-1",
      amount: 50,
      metadata: { reservationStatus: "active", expiresAt: new Date(Date.now() + 60_000).toISOString() },
    });
    prismaMock.usageRecord.update.mockResolvedValue({});

    const result = await usageReservationService.release({
      organisationId,
      reservationIdempotencyKey: "reserve-release",
    });

    expect(result.released).toBe(true);
    expect(prismaMock.usageRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 0 }),
      }),
    );
  });

  it("commits reservation with final amount", async () => {
    prismaMock.usageRecord.findUnique.mockResolvedValue({
      id: "res-1",
      amount: 50,
      metadata: { reservationStatus: "active", expiresAt: new Date(Date.now() + 60_000).toISOString() },
    });
    prismaMock.usageRecord.update.mockResolvedValue({});

    const result = await usageReservationService.commit({
      organisationId,
      reservationIdempotencyKey: "reserve-commit",
      finalAmount: 42,
    });

    expect(result.committed).toBe(true);
    expect(prismaMock.usageRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 42,
          metadata: expect.objectContaining({ reservationStatus: "committed" }),
        }),
      }),
    );
  });
});
