import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getSupabaseConfigMetadata,
  getSupabaseServerConfig,
  readSupabaseServerConfigFromProcessEnv,
} from "@/lib/environment/supabase";

describe("supabase server config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key";
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("prefers runtime server-only Supabase variables", () => {
    process.env.SUPABASE_URL = "https://prod-runtime.supabase.co";
    process.env.SUPABASE_ANON_KEY = "runtime-anon-key";

    expect(getSupabaseServerConfig()).toEqual({
      url: "https://prod-runtime.supabase.co",
      anonKey: "runtime-anon-key",
    });
    expect(getSupabaseConfigMetadata().usesRuntimeServerVars).toBe(true);
  });

  it("falls back to NEXT_PUBLIC values when server overrides are absent", () => {
    expect(readSupabaseServerConfigFromProcessEnv()).toEqual({
      url: "https://example.supabase.co",
      anonKey: "public-anon-key",
    });
  });
});
