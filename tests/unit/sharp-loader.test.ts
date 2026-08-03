import { beforeEach, describe, expect, it, vi } from "vitest";

const sharpConstructor = vi.fn();

vi.mock("sharp", () => ({
  default: sharpConstructor,
}));

describe("loadSharp", () => {
  beforeEach(() => {
    vi.resetModules();
    sharpConstructor.mockReset();
  });

  it("lazy-loads and caches the sharp module", async () => {
    const { loadSharp } = await import("@/lib/images/sharp-loader");

    const first = await loadSharp();
    const second = await loadSharp();

    expect(first).toBe(sharpConstructor);
    expect(second).toBe(sharpConstructor);
  });
});
