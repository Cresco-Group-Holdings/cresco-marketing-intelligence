import { classifyProductionEnvironment } from "@/lib/environment/classification";
import {
  resolveStripePriceId,
  SELF_SERVICE_PLAN_KEYS,
  STRIPE_PRICE_ENV_BY_PLAN,
} from "@/lib/billing/commercial-config";
import { isStripeBillingConfigured } from "@/server/providers/billing/stripe-billing-provider";
import {
  getCustomerConnectableLaunchMinimum,
  listLaunchProviderTruthContracts,
  type ProviderTruthContract,
} from "@/lib/providers/provider-truth-contract";
import { isProductionEnvironment } from "@/lib/security/production-guards";

export type ConfigCheckSeverity = "error" | "warn" | "info";

export type ConfigCheckResult = {
  id: string;
  category: string;
  message: string;
  severity: ConfigCheckSeverity;
  pass: boolean;
};

export type ProductionConfigReport = {
  mode: "production" | "staging" | "development" | "preview";
  passed: boolean;
  checks: ConfigCheckResult[];
  summary: Record<string, { pass: boolean; errors: number; warnings: number }>;
};

const FORBIDDEN_PRODUCTION_FLAGS: Array<{ key: string; reason: string }> = [
  { key: "ALLOW_TEST_AUTH", reason: "Test auth bypass must not be enabled in production." },
  { key: "CRESCO_E2E_HARNESS", reason: "E2E harness must not be enabled in production." },
  { key: "ALLOW_BILLING_MOCK", reason: "Billing mock mode must not be enabled in production." },
  { key: "ALLOW_OAUTH_MOCK", reason: "OAuth mock mode must not be enabled in production." },
  { key: "ALLOW_MOCK_SOCIAL_ADAPTERS", reason: "Mock social adapters must not be enabled in production." },
  { key: "CRON_ALLOW_PREVIEW", reason: "Preview cron side effects must not be enabled in production." },
  { key: "CRON_ALLOW_DEVELOPMENT", reason: "Development cron side effects must not be enabled in production." },
];

const NEXT_PUBLIC_ALLOWLIST = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_APP_URL",
]);

const SERVER_SECRET_PREFIXES = [
  "DATABASE_URL",
  "DIRECT_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ENCRYPTION_KEY",
  "STRIPE_BILLING_SECRET_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_BILLING_WEBHOOK_SECRET",
  "STRIPE_WEBHOOK_SECRET",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_AI_API_KEY",
  "WORKER_TOKEN",
  "PUBLISHING_WORKER_TOKEN",
  "CRON_SECRET",
  "GOOGLE_CLIENT_SECRET",
  "META_APP_SECRET",
  "LINKEDIN_CLIENT_SECRET",
  "X_CLIENT_SECRET",
];

function pushCheck(
  checks: ConfigCheckResult[],
  input: Omit<ConfigCheckResult, "pass"> & { pass?: boolean },
): void {
  checks.push({
    ...input,
    pass: input.pass ?? input.severity !== "error",
  });
}

function resolveConfigMode(): ProductionConfigReport["mode"] {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "preview";
  if (process.env.NODE_ENV === "production") return "production";
  if (process.env.NODE_ENV === "development") return "development";
  return "staging";
}

function isStrictProductionMode(mode: ProductionConfigReport["mode"]): boolean {
  return mode === "production";
}

function isTruthyEnv(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function stripeKeyMode(key: string | undefined): "live" | "test" | "unknown" | "missing" {
  if (!key?.trim()) return "missing";
  if (key.startsWith("sk_live_") || key.startsWith("pk_live_")) return "live";
  if (key.startsWith("sk_test_") || key.startsWith("pk_test_")) return "test";
  return "unknown";
}

function webhookSecretLooksValid(secret: string | undefined): boolean {
  return Boolean(secret?.trim() && secret.startsWith("whsec_"));
}

export function validateForbiddenProductionFlags(): ConfigCheckResult[] {
  const checks: ConfigCheckResult[] = [];
  const strict = isProductionEnvironment();

  for (const flag of FORBIDDEN_PRODUCTION_FLAGS) {
    const enabled = isTruthyEnv(process.env[flag.key]);
    pushCheck(checks, {
      id: `forbidden-flag-${flag.key}`,
      category: "test-auth-protection",
      message: enabled
        ? `${flag.key} is enabled — ${flag.reason}`
        : `${flag.key} is not enabled.`,
      severity: enabled && strict ? "error" : "info",
      pass: !enabled || !strict,
    });
  }

  return checks;
}

export function validateWorkerAndCronSecrets(): ConfigCheckResult[] {
  const checks: ConfigCheckResult[] = [];
  const workerToken =
    process.env.WORKER_TOKEN?.trim() || process.env.PUBLISHING_WORKER_TOKEN?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();
  const strict = isStrictProductionMode(resolveConfigMode());

  pushCheck(checks, {
    id: "worker-token-present",
    category: "worker-secrets",
    message: workerToken
      ? "Worker token is configured."
      : "Worker token (WORKER_TOKEN or PUBLISHING_WORKER_TOKEN) is not set.",
    severity: strict ? "error" : "warn",
    pass: Boolean(workerToken),
  });

  pushCheck(checks, {
    id: "cron-secret-present",
    category: "scheduler-cron",
    message: cronSecret
      ? "CRON_SECRET is configured."
      : "CRON_SECRET is not set (required for Vercel Cron authentication).",
    severity: strict ? "error" : "warn",
    pass: Boolean(cronSecret),
  });

  for (const key of ["WORKER_TOKEN", "PUBLISHING_WORKER_TOKEN", "CRON_SECRET"]) {
    const publicValue = process.env[`NEXT_PUBLIC_${key}`];
    pushCheck(checks, {
      id: `worker-secret-not-public-${key}`,
      category: "secret-isolation",
      message: publicValue
        ? `${key} is exposed via NEXT_PUBLIC_* — must remain server-only.`
        : `${key} is not exposed via NEXT_PUBLIC_*.`,
      severity: publicValue ? "error" : "info",
      pass: !publicValue,
    });
  }

  return checks;
}

export function validateStripeConfiguration(): ConfigCheckResult[] {
  const checks: ConfigCheckResult[] = [];
  const mode = resolveConfigMode();
  const strict = isStrictProductionMode(mode);
  const billingEnabled = isStripeBillingConfigured() || strict;

  const secretKey =
    process.env.STRIPE_BILLING_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
  const publishableKey =
    process.env.STRIPE_BILLING_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const webhookSecret =
    process.env.STRIPE_BILLING_WEBHOOK_SECRET ?? process.env.STRIPE_WEBHOOK_SECRET;

  const secretMode = stripeKeyMode(secretKey);
  const publishableMode = stripeKeyMode(publishableKey);

  pushCheck(checks, {
    id: "stripe-billing-configured",
    category: "stripe",
    message: isStripeBillingConfigured()
      ? "Stripe billing credentials are configured."
      : "Stripe billing credentials are not fully configured.",
    severity: billingEnabled && !isStripeBillingConfigured() ? "error" : "info",
    pass: !billingEnabled || isStripeBillingConfigured(),
  });

  if (secretKey && publishableKey) {
    const modesMatch =
      (secretMode === "live" && publishableMode === "live") ||
      (secretMode === "test" && publishableMode === "test");
    pushCheck(checks, {
      id: "stripe-key-mode-pairing",
      category: "stripe",
      message: modesMatch
        ? `Stripe secret and publishable keys share the same mode (${secretMode}).`
        : `Stripe key mode mismatch: secret=${secretMode}, publishable=${publishableMode}.`,
      severity: modesMatch ? "info" : "error",
      pass: modesMatch,
    });
  }

  if (strict) {
    pushCheck(checks, {
      id: "stripe-production-live-mode",
      category: "stripe",
      message:
        secretMode === "live"
          ? "Stripe secret key is in live mode."
          : `Production requires Stripe live mode; detected ${secretMode}.`,
      severity: secretMode === "live" ? "info" : "error",
      pass: secretMode === "live",
    });
  } else if (mode === "preview" || mode === "staging") {
    pushCheck(checks, {
      id: "stripe-staging-test-mode",
      category: "stripe",
      message:
        secretMode === "test" || secretMode === "missing"
          ? "Staging/preview uses Stripe test mode or billing is not configured."
          : "Staging/preview should not use Stripe live secret keys.",
      severity: secretMode === "live" ? "error" : "info",
      pass: secretMode !== "live",
    });
  }

  pushCheck(checks, {
    id: "stripe-webhook-secret-shape",
    category: "stripe",
    message: webhookSecretLooksValid(webhookSecret)
      ? "Stripe webhook secret is present and well-formed."
      : "Stripe webhook secret is missing or malformed.",
    severity: billingEnabled && !webhookSecretLooksValid(webhookSecret) ? "error" : "info",
    pass: !billingEnabled || webhookSecretLooksValid(webhookSecret),
  });

  for (const planKey of SELF_SERVICE_PLAN_KEYS) {
    const monthly = resolveStripePriceId(planKey, "MONTHLY");
    const annual = resolveStripePriceId(planKey, "ANNUAL");
    const envKeys = STRIPE_PRICE_ENV_BY_PLAN[planKey];
    const pass = Boolean(monthly && annual);
    pushCheck(checks, {
      id: `stripe-price-${planKey}`,
      category: "stripe",
      message: pass
        ? `Plan ${planKey} has monthly and annual Stripe price IDs configured.`
        : `Plan ${planKey} is missing Stripe price IDs (${envKeys?.monthly}, ${envKeys?.annual}).`,
      severity: billingEnabled && !pass ? "error" : "info",
      pass: !billingEnabled || pass,
    });
  }

  return checks;
}

export function validateProviderTruthContracts(): ConfigCheckResult[] {
  const checks: ConfigCheckResult[] = [];
  const contracts = listLaunchProviderTruthContracts();
  const connectable = getCustomerConnectableLaunchMinimum();

  for (const contract of contracts) {
    if (
      (contract.customerAvailability === "available" ||
        contract.customerAvailability === "beta") &&
      contract.configurationStatus !== "ready"
    ) {
      pushCheck(checks, {
        id: `provider-truth-${contract.providerKey}`,
        category: "provider-oauth",
        message: `Provider ${contract.displayName} is customer-${contract.customerAvailability} but configuration is ${contract.configurationStatus}.`,
        severity: "error",
        pass: false,
      });
    }
  }

  pushCheck(checks, {
    id: "provider-connectable-summary",
    category: "provider-oauth",
    message: `Customer-connectable launch providers: ${connectable.join(", ") || "(none)"}.`,
    severity: "info",
    pass: true,
  });

  return checks;
}

export function validateApplicationUrls(): ConfigCheckResult[] {
  const checks: ConfigCheckResult[] = [];
  const appUrl = process.env.APP_URL;
  const strict = isStrictProductionMode(resolveConfigMode());

  try {
    const parsed = appUrl ? new URL(appUrl) : null;
    const isLocal =
      parsed?.hostname.includes("localhost") || parsed?.hostname.includes("127.0.0.1");
    pushCheck(checks, {
      id: "app-url-present",
      category: "application",
      message: appUrl ? `APP_URL is set (${parsed?.protocol}//${parsed?.host}).` : "APP_URL is missing.",
      severity: !appUrl && strict ? "error" : !appUrl ? "warn" : "info",
      pass: Boolean(appUrl) || !strict,
    });
    pushCheck(checks, {
      id: "app-url-not-localhost",
      category: "application",
      message: isLocal
        ? "APP_URL points to localhost — invalid for deployed environments."
        : "APP_URL does not point to localhost.",
      severity: isLocal && strict ? "error" : "info",
      pass: !isLocal || !strict,
    });
    pushCheck(checks, {
      id: "app-url-https",
      category: "dns-https",
      message:
        parsed?.protocol === "https:"
          ? "APP_URL uses HTTPS."
          : "APP_URL does not use HTTPS.",
      severity: parsed?.protocol !== "https:" && strict ? "error" : "info",
      pass: parsed?.protocol === "https:" || !strict,
    });
  } catch {
    pushCheck(checks, {
      id: "app-url-invalid",
      category: "application",
      message: "APP_URL is not a valid URL.",
      severity: "error",
      pass: false,
    });
  }

  return checks;
}

export function validateDatabaseConnectionMode(): ConfigCheckResult[] {
  const checks: ConfigCheckResult[] = [];
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const directUrl = process.env.DIRECT_URL ?? "";

  const usesPooler =
    databaseUrl.includes("pooler.supabase.com") ||
    databaseUrl.includes(":6543") ||
    databaseUrl.includes("pgbouncer=true");
  const directUsesSessionPort =
    directUrl.includes(":5432") || directUrl.includes("db.") && !directUrl.includes("pooler");

  pushCheck(checks, {
    id: "database-url-pooling",
    category: "database",
    message: usesPooler
      ? "DATABASE_URL appears to use connection pooling (recommended for serverless runtime)."
      : "DATABASE_URL does not appear to use Supabase pooler — verify serverless connection settings.",
    severity: usesPooler ? "info" : "warn",
    pass: true,
  });

  pushCheck(checks, {
    id: "direct-url-for-migrations",
    category: "database",
    message: directUrl
      ? directUsesSessionPort
        ? "DIRECT_URL appears suitable for migrations/direct connections."
        : "DIRECT_URL may be using pooler — migrations should use direct/session port."
      : "DIRECT_URL is missing.",
    severity: !directUrl ? (strict ? "error" : "warn") : directUsesSessionPort ? "info" : "warn",
    pass: Boolean(directUrl) || !strict,
  });

  if (databaseUrl && directUrl && databaseUrl === directUrl) {
    pushCheck(checks, {
      id: "database-direct-url-distinct",
      category: "database",
      message: "DATABASE_URL and DIRECT_URL are identical — pooler/direct separation recommended.",
      severity: "warn",
      pass: true,
    });
  }

  return checks;
}

export function validateProductionEnvironmentClassification(): ConfigCheckResult[] {
  const checks: ConfigCheckResult[] = [];
  const classification = classifyProductionEnvironment();
  const strict = isStrictProductionMode(resolveConfigMode());

  for (const blocker of classification.blockers) {
    pushCheck(checks, {
      id: `production-classification-${blocker.slice(0, 40).replace(/\s+/g, "-").toLowerCase()}`,
      category: "environment-separation",
      message: blocker,
      severity: strict ? "error" : "warn",
      pass: false,
    });
  }

  if (classification.isProductionReady) {
    pushCheck(checks, {
      id: "production-classification-ready",
      category: "environment-separation",
      message: "Production environment classification passed.",
      severity: "info",
      pass: true,
    });
  }

  return checks;
}

export function validateAiProviderConfiguration(): ConfigCheckResult[] {
  const checks: ConfigCheckResult[] = [];
  const providers = [
    { key: "OPENAI_API_KEY", label: "OpenAI" },
    { key: "ANTHROPIC_API_KEY", label: "Anthropic" },
    { key: "GOOGLE_AI_API_KEY", label: "Google AI" },
  ];
  const configured = providers.filter((provider) => Boolean(process.env[provider.key]?.trim()));

  pushCheck(checks, {
    id: "ai-provider-configured",
    category: "ai",
    message: configured.length
      ? `AI provider key configured: ${configured.map((p) => p.label).join(", ")}.`
      : "No AI provider API key is configured.",
    severity: configured.length ? "info" : "warn",
    pass: configured.length > 0,
  });

  for (const provider of providers) {
    const publicValue = process.env[`NEXT_PUBLIC_${provider.key}`];
    pushCheck(checks, {
      id: `ai-key-not-public-${provider.key}`,
      category: "secret-isolation",
      message: publicValue
        ? `${provider.key} is exposed via NEXT_PUBLIC_* — must remain server-only.`
        : `${provider.key} is not exposed via NEXT_PUBLIC_*.`,
      severity: publicValue ? "error" : "info",
      pass: !publicValue,
    });
  }

  return checks;
}

export function validateNextPublicAudit(): ConfigCheckResult[] {
  const checks: ConfigCheckResult[] = [];

  for (const key of Object.keys(process.env)) {
    if (!key.startsWith("NEXT_PUBLIC_")) continue;

    const allowed = NEXT_PUBLIC_ALLOWLIST.has(key);
    pushCheck(checks, {
      id: `next-public-${key}`,
      category: "secret-isolation",
      message: allowed
        ? `${key} is an approved public configuration variable.`
        : `${key} is not in the NEXT_PUBLIC allowlist — review for accidental secret exposure.`,
      severity: allowed ? "info" : "warn",
      pass: allowed,
    });
  }

  for (const secretPrefix of SERVER_SECRET_PREFIXES) {
    const leaked = process.env[`NEXT_PUBLIC_${secretPrefix}`];
    if (leaked) {
      pushCheck(checks, {
        id: `next-public-leak-${secretPrefix}`,
        category: "secret-isolation",
        message: `Server secret ${secretPrefix} is exposed as NEXT_PUBLIC_${secretPrefix}.`,
        severity: "error",
        pass: false,
      });
    }
  }

  return checks;
}

export function validateDisabledProviderStartupTolerance(): ConfigCheckResult[] {
  const checks: ConfigCheckResult[] = [];
  const contracts = listLaunchProviderTruthContracts();
  const disabled = contracts.filter((row) => row.configurationStatus === "disabled");

  pushCheck(checks, {
    id: "disabled-providers-non-blocking",
    category: "provider-oauth",
    message: `${disabled.length} provider(s) are disabled by configuration — startup must not require their credentials.`,
    severity: "info",
    pass: true,
  });

  return checks;
}

function summarizeChecks(checks: ConfigCheckResult[]): ProductionConfigReport["summary"] {
  const summary: ProductionConfigReport["summary"] = {};

  for (const check of checks) {
    if (!summary[check.category]) {
      summary[check.category] = { pass: true, errors: 0, warnings: 0 };
    }
    if (!check.pass) {
      summary[check.category].pass = false;
    }
    if (check.severity === "error" && !check.pass) {
      summary[check.category].errors += 1;
    }
    if (check.severity === "warn" && !check.pass) {
      summary[check.category].warnings += 1;
    }
  }

  return summary;
}

export function runProductionConfigValidation(): ProductionConfigReport {
  const checks: ConfigCheckResult[] = [
    ...validateForbiddenProductionFlags(),
    ...validateWorkerAndCronSecrets(),
    ...validateStripeConfiguration(),
    ...validateProviderTruthContracts(),
    ...validateApplicationUrls(),
    ...validateDatabaseConnectionMode(),
    ...validateProductionEnvironmentClassification(),
    ...validateAiProviderConfiguration(),
    ...validateNextPublicAudit(),
    ...validateDisabledProviderStartupTolerance(),
  ];

  const hasErrors = checks.some((check) => check.severity === "error" && !check.pass);

  return {
    mode: resolveConfigMode(),
    passed: !hasErrors,
    checks,
    summary: summarizeChecks(checks),
  };
}

export function formatProductionConfigReport(report: ProductionConfigReport): string {
  const lines: string[] = [
    `Production configuration validation — mode: ${report.mode}`,
    `Overall: ${report.passed ? "PASS" : "FAIL"}`,
    "",
  ];

  for (const [category, stats] of Object.entries(report.summary)) {
    lines.push(
      `${stats.pass ? "PASS" : "FAIL"}  ${category} (errors: ${stats.errors}, warnings: ${stats.warnings})`,
    );
  }

  lines.push("");
  const failures = report.checks.filter((check) => !check.pass);
  if (failures.length > 0) {
    lines.push("Findings:");
    for (const check of failures) {
      lines.push(`  [${check.severity}] ${check.id}: ${check.message}`);
    }
  }

  return lines.join("\n");
}

export function getLaunchProviderMatrix(): ProviderTruthContract[] {
  return listLaunchProviderTruthContracts();
}
