# Provider Environment Matrix

Environment variable classification and Vercel deployment matrix for the Task 7.1 provider integration foundation.

## Variable Classification

### Legend

| Class | Meaning |
|-------|---------|
| **public** | Safe for client bundles (`NEXT_PUBLIC_*`) |
| **server-only** | Never exposed to browser; runtime server access only |
| **build-time** | Required during `next build`; baked into server bundle |
| **runtime** | Read at request/job execution time (may change without rebuild) |
| **optional-provider** | Required only when a specific provider is enabled |
| **mandatory-platform** | Required for application startup |
| **test-only** | Set in test fixtures; not used in production |

### Mandatory Platform

| Variable | Class | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | mandatory-platform, server-only, runtime | Postgres connection (pooled) |
| `DIRECT_URL` | mandatory-platform, server-only, runtime | Postgres direct connection (migrations) |
| `SUPABASE_SERVICE_ROLE_KEY` | mandatory-platform, server-only, runtime | Supabase admin operations |
| `APP_URL` | mandatory-platform, server-only, runtime | Canonical app URL (OAuth redirects, links) |
| `ENCRYPTION_KEY` | mandatory-platform, server-only, runtime | Credential encryption (min 32 chars) |
| `NEXT_PUBLIC_SUPABASE_URL` | mandatory-platform, public, build-time | Client Supabase endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | mandatory-platform, public, build-time | Client Supabase anon key |

### Provider Platform (Task 7.1)

| Variable | Class | Default | Purpose |
|----------|-------|---------|---------|
| `PROVIDER_CONNECTORS_ENABLED` | server-only, runtime | enabled (`!== "false"`) | Gate connection CRUD and OAuth start |
| `PROVIDER_LIVE_CALLS_ENABLED` | server-only, runtime | disabled (`!== "true"`) | Gate external API calls (7.2+) |
| `OAUTH_STATE_SIGNING_KEY` | server-only, runtime | falls back to `ENCRYPTION_KEY` | HMAC key for OAuth state payloads |
| `OAUTH_CALLBACK_BASE_URL` | server-only, runtime | falls back to `{APP_URL}/api/providers/oauth/callback` | OAuth redirect URI base |
| `WEBHOOK_BASE_URL` | server-only, runtime | unset | Public webhook endpoint base URL |
| `PROVIDER_ENCRYPTION_KEY` | server-only, runtime | unset (uses `ENCRYPTION_KEY`) | Dedicated provider credential key (future) |
| `PROVIDER_ENCRYPTION_KEY_VERSION` | server-only, runtime | unset | Key version tracking (future) |

### Optional Provider Credentials

Required only when the corresponding provider is enabled in Task 7.2+.

| Variable | Provider(s) | Class |
|----------|------------|-------|
| `GOOGLE_CLIENT_ID` | Google Analytics, Search Console, Ads, YouTube | optional-provider, server-only, runtime |
| `GOOGLE_CLIENT_SECRET` | Same | optional-provider, server-only, runtime |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads | optional-provider, server-only, runtime |
| `META_APP_ID` | Meta, Instagram, Facebook, Meta Ads | optional-provider, server-only, runtime |
| `META_APP_SECRET` | Same | optional-provider, server-only, runtime |
| `LINKEDIN_CLIENT_ID` | LinkedIn, LinkedIn Ads | optional-provider, server-only, runtime |
| `LINKEDIN_CLIENT_SECRET` | Same | optional-provider, server-only, runtime |
| `TIKTOK_CLIENT_KEY` | TikTok, TikTok Ads | optional-provider, server-only, runtime |
| `TIKTOK_CLIENT_SECRET` | Same | optional-provider, server-only, runtime |
| `X_CLIENT_ID` | X (Twitter) | optional-provider, server-only, runtime |
| `X_CLIENT_SECRET` | Same | optional-provider, server-only, runtime |

### AI Providers (Not Part of 7.1 Registry)

| Variable | Class |
|----------|-------|
| `OPENAI_API_KEY` | optional-provider, server-only, runtime |
| `ANTHROPIC_API_KEY` | optional-provider, server-only, runtime |
| `GOOGLE_AI_API_KEY` | optional-provider, server-only, runtime |

### Test-Only

Set in unit/integration test `beforeEach` blocks. Never configure in Vercel.

| Variable | Example | Purpose |
|----------|---------|---------|
| `ENCRYPTION_KEY` | `"a".repeat(32)` | Deterministic encryption in tests |
| `OAUTH_STATE_SIGNING_KEY` | `"b".repeat(32)` | Deterministic state signing in tests |

## Vercel Environment Matrix

### Development (Local)

| Variable | Value | Notes |
|----------|-------|-------|
| `APP_URL` | `http://localhost:3000` | Local dev server |
| `ENCRYPTION_KEY` | Local-only secret (32+ chars) | Unique to local machine |
| `PROVIDER_CONNECTORS_ENABLED` | unset (enabled) | Connectors work locally |
| `PROVIDER_LIVE_CALLS_ENABLED` | unset (disabled) | No live API calls in 7.1 |
| Provider credentials | unset | Not required for 7.1 foundation tests |
| `DATABASE_URL` | Local Postgres or Supabase local | Separate from production |

OAuth redirect (when wired in 7.2): `http://localhost:3000/api/providers/oauth/callback`

### Preview (Vercel Preview Deployments)

| Variable | Value | Notes |
|----------|-------|-------|
| `APP_URL` | `https://<branch>-<project>.vercel.app` | Auto-set or manual |
| `ENCRYPTION_KEY` | Preview-specific secret | **Must differ from Production** |
| `DATABASE_URL` | Preview/staging database | Isolated from production data |
| `DIRECT_URL` | Preview direct connection | Required for migrations |
| `PROVIDER_CONNECTORS_ENABLED` | `true` (default) | Allow connector testing |
| `PROVIDER_LIVE_CALLS_ENABLED` | `false` | Keep disabled until 7.2 adapter ready |
| `OAUTH_CALLBACK_BASE_URL` | Preview callback URL | Register in provider dev/sandbox app |
| Provider credentials | Sandbox/dev app credentials | Never use production OAuth apps |
| `OAUTH_STATE_SIGNING_KEY` | Preview-specific | Recommended separate from `ENCRYPTION_KEY` |

OAuth redirect: `https://<preview-domain>/api/providers/oauth/callback`

### Production

| Variable | Value | Notes |
|----------|-------|-------|
| `APP_URL` | `https://<production-domain>` | Canonical production URL |
| `ENCRYPTION_KEY` | Production secret (32+ chars) | Rotate on compromise |
| `DATABASE_URL` | Production Postgres | Pooled connection |
| `DIRECT_URL` | Production direct connection | Migrations only |
| `PROVIDER_CONNECTORS_ENABLED` | `true` | Enable after onboarding checklist complete |
| `PROVIDER_LIVE_CALLS_ENABLED` | `false` until 7.2 go-live | Explicit opt-in required |
| `OAUTH_CALLBACK_BASE_URL` | `https://<production-domain>/api/providers/oauth/callback` | Register in production OAuth app |
| `WEBHOOK_BASE_URL` | `https://<production-domain>/api/providers/webhooks` | Register with providers (7.2+) |
| Provider credentials | Production OAuth app credentials | Separate apps per provider |
| `OAUTH_STATE_SIGNING_KEY` | Production-specific | Strong random value |

## Environment Isolation Rules

1. **Never share `ENCRYPTION_KEY`** across Development, Preview, and Production.
2. **Never share OAuth app credentials** across environments — use provider sandbox/dev apps for Preview.
3. **Never point Preview at Production database** — use separate Postgres instances.
4. **Never set `PROVIDER_LIVE_CALLS_ENABLED=true`** in Preview until adapter is validated.
5. **Provider tenant credentials** (stored encrypted in `ProviderCredential`) are per-organisation and isolated by `organisationId` — not env vars.

## Startup Validation

`validateEnvironmentOnStartup()` (via `getServerEnv()`) validates mandatory platform variables at boot. Missing `ENCRYPTION_KEY` or `DATABASE_URL` prevents startup.

Optional provider variables are **not** validated at startup — `getIntegrationStatus()` reports configuration state without failing boot.

## Integration Status Check

```typescript
getIntegrationStatus(env)
// Returns: { google: { configured: bool }, meta: { configured: bool }, ... }
```

A provider is "configured" when all required env vars for that provider are set. This does not mean the provider is enabled in the registry.

## Task 7.1 Minimum Requirements

For the foundation layer (no live API calls):

| Environment | Required |
|-------------|----------|
| All | `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `ENCRYPTION_KEY`, `NEXT_PUBLIC_SUPABASE_*` |
| All | `PROVIDER_LIVE_CALLS_ENABLED` unset or `false` |
| Optional | `OAUTH_STATE_SIGNING_KEY` (recommended for production) |
| Not required | Any `*_CLIENT_ID`, `*_CLIENT_SECRET`, `*_APP_ID` provider credentials |

Unit and integration tests set `ENCRYPTION_KEY` in fixtures and do not require provider credentials.

## Related Documentation

- [PROVIDER_SECURITY_MODEL.md](./PROVIDER_SECURITY_MODEL.md)
- [PROVIDER_ONBOARDING_CHECKLIST.md](./PROVIDER_ONBOARDING_CHECKLIST.md)
- [PROVIDER_CONFIGURATION.md](./PROVIDER_CONFIGURATION.md) (legacy social OAuth config)
