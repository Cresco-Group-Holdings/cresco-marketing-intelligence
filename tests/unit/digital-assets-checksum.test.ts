import { describe, expect, it } from "vitest";
import { computeAssetChecksum } from "@/lib/digital-assets/checksum";

describe("computeAssetChecksum", () => {
  it("returns deterministic sha256 hex", () => {
    const buffer = Buffer.from("test asset content");
    const a = computeAssetChecksum(buffer);
    const b = computeAssetChecksum(buffer);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});
