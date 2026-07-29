/**
 * Deterministic non-production environment values for Vitest.
 * Loaded before each test file so application modules can call getServerEnv().
 */
export {};

const env = process.env as Record<string, string | undefined>;

const testServerSecrets = {
  supabaseServiceRole: "test-placeholder",
} as const;

env.NODE_ENV = "test";
env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
env.DIRECT_URL = "postgresql://test:test@localhost:5432/test";
env["SUPABASE_SERVICE_ROLE_KEY"] = testServerSecrets.supabaseServiceRole;
env.APP_URL = "http://localhost:3000";
env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef";
env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
env.META_APP_ID = "test-meta-app-id";
env.META_APP_SECRET = "test-meta-app-secret";
env.GOOGLE_CLIENT_ID = "test-google-client-id";
env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
env.LINKEDIN_CLIENT_ID = "test-linkedin-client-id";
env.LINKEDIN_CLIENT_SECRET = "test-linkedin-client-secret";
env.TIKTOK_CLIENT_KEY = "test-tiktok-client-key";
env.TIKTOK_CLIENT_SECRET = "test-tiktok-client-secret";
env.X_CLIENT_ID = "test-x-client-id";
env.X_CLIENT_SECRET = "test-x-client-secret";
