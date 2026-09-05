import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();

function withTempPackageJson(
  mutate: (pkg: { scripts: Record<string, string> }) => void,
  run: (tempPackagePath: string) => void,
) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vercel-build-guard-"));
  const tempPackagePath = path.join(tempDir, "package.json");
  const originalPath = path.join(root, "package.json");
  const pkg = JSON.parse(fs.readFileSync(originalPath, "utf8"));
  mutate(pkg);
  fs.writeFileSync(tempPackagePath, JSON.stringify(pkg, null, 2) + "\n");

  try {
    run(tempPackagePath);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

describe("validate:vercel-build", () => {
  it("passes for the lean production build script", () => {
    expect(() => {
      execSync("node scripts/validate-vercel-build.mjs", { stdio: "pipe" });
    }).not.toThrow();
  });

  it("rejects build scripts that run validators", () => {
    withTempPackageJson(
      (pkg) => {
        pkg.scripts.build = "npm run validate:routes && next build";
      },
      (tempPackagePath) => {
        expect(() => {
          execSync("node scripts/validate-vercel-build.mjs", {
            stdio: "pipe",
            env: { ...process.env, PACKAGE_JSON_PATH: tempPackagePath },
          });
        }).toThrow();
      },
    );
  });

  it("rejects build scripts with max-old-space-size=8192", () => {
    withTempPackageJson(
      (pkg) => {
        pkg.scripts.build = "NODE_OPTIONS=--max-old-space-size=8192 next build";
      },
      (tempPackagePath) => {
        expect(() => {
          execSync("node scripts/validate-vercel-build.mjs", {
            stdio: "pipe",
            env: { ...process.env, PACKAGE_JSON_PATH: tempPackagePath },
          });
        }).toThrow();
      },
    );
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

  it("builds staging only on dedicated staging Vercel project (exit 1)", () => {
    expect(() => {
      execSync(script, {
        env: {
          ...process.env,
          VERCEL_GIT_COMMIT_REF: "staging",
          VERCEL_PROJECT_NAME: "cresco-marketing-intelligence-staging",
        },
        stdio: "pipe",
      });
    }).toThrow(); // exit 1
  });

  it("skips staging on customer production Vercel project (exit 0)", () => {
    const result = execSync(script, {
      env: {
        ...process.env,
        VERCEL_GIT_COMMIT_REF: "staging",
        VERCEL_PROJECT_NAME: "cresco-marketing-intelligence",
      },
      stdio: "pipe",
    });
    expect(result.toString()).toMatch(/Skipping: staging branch/);
  });

  it("skips staging when project name is unknown (exit 0)", () => {
    const result = execSync(script, {
      env: { ...process.env, VERCEL_GIT_COMMIT_REF: "staging" },
      stdio: "pipe",
    });
    expect(result.toString()).toMatch(/Skipping: staging branch/);
  });

  it("skips cursor branches without opt-in (exit 0)", () => {
    const result = execSync(script, {
      env: { ...process.env, VERCEL_GIT_COMMIT_REF: "cursor/feature-7a66" },
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
