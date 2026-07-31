import { describe, expect, it } from "vitest";
import { hashPayload } from "@/lib/warehouse/payload-hash";

describe("warehouse payload hashing", () => {
  it("produces stable hashes regardless of object key order", () => {
    const first = hashPayload({ b: 2, a: 1, nested: { z: 3, y: 4 } });
    const second = hashPayload({ a: 1, nested: { y: 4, z: 3 }, b: 2 });
    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });

  it("differentiates distinct payloads", () => {
    expect(hashPayload({ clicks: 10 })).not.toBe(hashPayload({ clicks: 11 }));
    expect(hashPayload({ clicks: 10 })).not.toBe(hashPayload({ impressions: 10 }));
  });

  it("handles arrays and null values deterministically", () => {
    const withNull = hashPayload({ values: [1, null, 3] });
    const again = hashPayload({ values: [1, null, 3] });
    expect(withNull).toBe(again);
    expect(hashPayload({ values: [1, 2, 3] })).not.toBe(withNull);
  });
});
