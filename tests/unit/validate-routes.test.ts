import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";

describe("validate:routes", () => {
  it("reports no dynamic slug conflicts in src/app", () => {
    const output = execSync("node scripts/validate-routes.mjs", {
      encoding: "utf8",
    });

    expect(output).toContain("no dynamic slug conflicts");
  });
});
