import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("validate:vercel-build", () => {
  it("passes for the lean production build script", () => {
    expect(() => {
      execSync("node scripts/validate-vercel-build.mjs", { stdio: "pipe" });
    }).not.toThrow();
  });

  it("rejects build scripts that run validators", () => {
    const packagePath = path.join(root, "package.json");
    const original = fs.readFileSync(packagePath, "utf8");
    const pkg = JSON.parse(original);
    const savedBuild = pkg.scripts.build;
    pkg.scripts.build = "npm run validate:routes && next build";
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");

    try {
      expect(() => {
        execSync("node scripts/validate-vercel-build.mjs", { stdio: "pipe" });
      }).toThrow();
    } finally {
      pkg.scripts.build = savedBuild;
      fs.writeFileSync(packagePath, original);
    }
  });

  it("rejects vercel.json buildCommand with max-old-space-size=8192", () => {
    const vercelPath = path.join(root, "vercel.json");
    const original = fs.readFileSync(vercelPath, "utf8");
    const vercelJson = JSON.parse(original);
    const savedBuildCommand = vercelJson.buildCommand;
    vercelJson.buildCommand = "NODE_OPTIONS=--max-old-space-size=8192 next build";
    fs.writeFileSync(vercelPath, JSON.stringify(vercelJson, null, 2) + "\n");

    try {
      expect(() => {
        execSync("node scripts/validate-vercel-build.mjs", { stdio: "pipe" });
      }).toThrow();
    } finally {
      vercelJson.buildCommand = savedBuildCommand;
      fs.writeFileSync(vercelPath, original);
    }
  });

  it("rejects effective config when ignoreBuildErrors is removed from next.config.mjs", async () => {
    const configPath = path.join(root, "next.config.mjs");
    const original = fs.readFileSync(configPath, "utf8");
    const downgraded = original.replace("ignoreBuildErrors: true", "ignoreBuildErrors: false");
    fs.writeFileSync(configPath, downgraded);

    try {
      expect(() => {
        execSync("node scripts/validate-vercel-build.mjs", { stdio: "pipe" });
      }).toThrow();
    } finally {
      fs.writeFileSync(configPath, original);
    }
  });

  it("rejects build scripts with max-old-space-size=8192", () => {
    const packagePath = path.join(root, "package.json");
    const original = fs.readFileSync(packagePath, "utf8");
    const pkg = JSON.parse(original);
    const savedBuild = pkg.scripts.build;
    pkg.scripts.build = "NODE_OPTIONS=--max-old-space-size=8192 next build";
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");

    try {
      expect(() => {
        execSync("node scripts/validate-vercel-build.mjs", { stdio: "pipe" });
      }).toThrow();
    } finally {
      pkg.scripts.build = savedBuild;
      fs.writeFileSync(packagePath, original);
    }
  });
});

describe("vercel-should-build.sh", () => {
  const script = "bash scripts/vercel-should-build.sh";

  it("builds main (exit 1)", () => {
    expect(() => {
      execSync(script, {
        env: { ...process.env, VERCEL_GIT_COMMIT_REF: "main" },
        stdio: "pipe",
      });
    }).toThrow(); // exit 1
  });

  it("skips cursor branches without opt-in (exit 0)", () => {
    const result = execSync(script, {
      env: {
        ...process.env,
        VERCEL_GIT_COMMIT_REF: "cursor/feature-7a66",
        VERCEL_SHOULD_BUILD_TEST_BRANCH_ONLY: "1",
      },
      stdio: "pipe",
    });
    expect(result.toString()).toMatch(/Skipping/);
  });

  it("builds when preview marker exists (exit 1)", () => {
    fs.mkdirSync(path.join(root, ".vercel"), { recursive: true });
    const marker = path.join(root, ".vercel/preview-required");
    fs.writeFileSync(marker, "test\n");
    try {
      expect(() => {
        execSync(script, {
          env: { ...process.env, VERCEL_GIT_COMMIT_REF: "cursor/feature-7a66" },
          stdio: "pipe",
        });
      }).toThrow();
    } finally {
      fs.rmSync(marker, { force: true });
    }
  });
});
