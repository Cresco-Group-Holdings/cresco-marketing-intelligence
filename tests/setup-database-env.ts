/**
 * Environment for the isolated real-database suite. Unlike `tests/setup-env.ts`, DATABASE_URL must
 * point at a disposable PostgreSQL instance because Prisma actually connects to it.
 */
export {};

const env = process.env as Record<string, string | undefined>;

env.NODE_ENV = "test";
env.APP_URL = "http://localhost:3000";
env.ENCRYPTION_KEY = env.ENCRYPTION_KEY ?? "0123456789abcdef0123456789abcdef";
env["SUPABASE_SERVICE_ROLE_KEY"] = env["SUPABASE_SERVICE_ROLE_KEY"] ?? "test-placeholder";
env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co";
env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "test-anon-key";
env.META_APP_ID = env.META_APP_ID ?? "test-meta-app-id";
env.META_APP_SECRET = env.META_APP_SECRET ?? "test-meta-app-secret";
env.GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID ?? "test-google-client-id";
env.GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET ?? "test-google-client-secret";
env.LINKEDIN_CLIENT_ID = env.LINKEDIN_CLIENT_ID ?? "test-linkedin-client-id";
env.LINKEDIN_CLIENT_SECRET = env.LINKEDIN_CLIENT_SECRET ?? "test-linkedin-client-secret";
env.TIKTOK_CLIENT_KEY = env.TIKTOK_CLIENT_KEY ?? "test-tiktok-client-key";
env.TIKTOK_CLIENT_SECRET = env.TIKTOK_CLIENT_SECRET ?? "test-tiktok-client-secret";
env.X_CLIENT_ID = env.X_CLIENT_ID ?? "test-x-client-id";
env.X_CLIENT_SECRET = env.X_CLIENT_SECRET ?? "test-x-client-secret";
env.PUBLISHING_WORKER_TOKEN = env.PUBLISHING_WORKER_TOKEN ?? "database-suite-worker-token";

if (env.ANALYTICS_TEST_DATABASE_URL) {
  env.DATABASE_URL = env.ANALYTICS_TEST_DATABASE_URL;
  env.DIRECT_URL = env.ANALYTICS_TEST_DATABASE_URL;
} else {
  env.DATABASE_URL = env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/test";
  env.DIRECT_URL = env.DIRECT_URL ?? env.DATABASE_URL;
}
