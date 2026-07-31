import { describe, expect, it } from "vitest";
import { chunkArray } from "@/lib/warehouse/chunking";
import { WAREHOUSE_MAX_BATCH_SIZE } from "@/lib/warehouse/constants";

describe("warehouse import chunking", () => {
  it("keeps 5,000 rows in a single chunk", () => {
    const rows = Array.from({ length: 5_000 }, (_, index) => index);
    expect(chunkArray(rows, WAREHOUSE_MAX_BATCH_SIZE)).toHaveLength(1);
    expect(chunkArray(rows, WAREHOUSE_MAX_BATCH_SIZE)[0]).toHaveLength(5_000);
  });

  it("splits 5,001 rows into two ingestion chunks", () => {
    const rows = Array.from({ length: 5_001 }, (_, index) => index);
    const chunks = chunkArray(rows, WAREHOUSE_MAX_BATCH_SIZE);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(5_000);
    expect(chunks[1]).toHaveLength(1);
  });

  it("splits 10,000 rows into two full chunks", () => {
    const rows = Array.from({ length: 10_000 }, (_, index) => index);
    const chunks = chunkArray(rows, WAREHOUSE_MAX_BATCH_SIZE);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(5_000);
    expect(chunks[1]).toHaveLength(5_000);
  });
});
