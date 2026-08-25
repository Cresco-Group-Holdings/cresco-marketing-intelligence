export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertTestAuthNotEnabledInProduction } = await import(
      "@/lib/security/production-guards"
    );

    assertTestAuthNotEnabledInProduction();

    if (process.env.NODE_ENV === "production") {
      const { validateEnvironmentOnStartup } = await import("@/lib/environment");
      validateEnvironmentOnStartup();
    }
  }
}
