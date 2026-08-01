import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getSupabaseConfigMetadata,
  getSupabaseServerConfig,
  readSupabaseServerConfigFromProcessEnv,
} from "@/lib/environment/supabase";

const SYNTHETIC_SUPABASE_URL = "https://tests-project.supabase.co";
const SYNTHETIC_PUBLIC_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.anonkey-for-unit-tests";
const SYNTHETIC_RUNTIME_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.runtime-anon-for-unit-tests";

describe("supabase server config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = SYNTHETIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = SYNTHETIC_PUBLIC_ANON_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("prefers runtime server-only Supabase variables", () => {
    process.env.SUPABASE_URL = SYNTHETIC_SUPABASE_URL;
    process.env.SUPABASE_ANON_KEY = SYNTHETIC_RUNTIME_ANON_KEY;

    expect(getSupabaseServerConfig()).toEqual({
      url: SYNTHETIC_SUPABASE_URL,
      anonKey: SYNTHETIC_RUNTIME_ANON_KEY,
    });
    expect(getSupabaseConfigMetadata().usesRuntimeServerVars).toBe(true);
  });

  it("falls back to NEXT_PUBLIC values when server overrides are absent", () => {
    expect(readSupabaseServerConfigFromProcessEnv()).toEqual({
      url: SYNTHETIC_SUPABASE_URL,
      anonKey: SYNTHETIC_PUBLIC_ANON_KEY,
    });
  });
});
