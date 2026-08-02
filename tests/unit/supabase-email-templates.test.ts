import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TEMPLATE_PATH = resolve(
  process.cwd(),
  "supabase/templates/confirm-signup.html",
);

describe("Supabase confirm-signup email template", () => {
  it("uses token_hash server-side callback instead of ConfirmationURL", () => {
    const template = readFileSync(TEMPLATE_PATH, "utf8");

    expect(template).toContain("token_hash={{ .TokenHash }}");
    expect(template).toContain("/auth/callback");
    expect(template).toContain("type=email");
    expect(template).toContain("redirect=/dashboard");
    expect(template).not.toContain("{{ .ConfirmationURL }}");
  });

  it("is referenced from supabase/config.toml", () => {
    const config = readFileSync(resolve(process.cwd(), "supabase/config.toml"), "utf8");

    expect(config).toContain("[auth.email.template.confirmation]");
    expect(config).toContain("./supabase/templates/confirm-signup.html");
  });
});
