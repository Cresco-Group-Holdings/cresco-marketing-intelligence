import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WORKFLOW_PATH = path.join(
  process.cwd(),
  ".github",
  "workflows",
  "supabase-auth-email-templates.yml",
);

describe("supabase-auth-email-templates workflow", () => {
  it("requires explicit confirmation and production secrets", () => {
    const workflow = readFileSync(WORKFLOW_PATH, "utf8");

    expect(workflow).toContain('confirmation == \'DEPLOY_EMAIL_TEMPLATES\'');
    expect(workflow).toContain("SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}");
    expect(workflow).toContain("SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}");
    expect(workflow).toContain("node scripts/deploy-supabase-auth-email-templates.mjs");
  });
});
