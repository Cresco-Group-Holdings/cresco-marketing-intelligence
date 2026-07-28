import { describe, expect, it } from "vitest";
import { assertAtLeastOneOwnerRemains } from "@/server/services/workspace-service";

describe("final owner protection", () => {
  it("exports owner protection helper", () => {
    expect(typeof assertAtLeastOneOwnerRemains).toBe("function");
  });
});
