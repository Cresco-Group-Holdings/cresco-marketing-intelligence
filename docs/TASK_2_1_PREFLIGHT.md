# Task 2.1 Pre-flight Audit

This document records the pre-flight review before implementing Social Account Connections (Task 2.1).

## Connector Framework (Task 1.8)

| Component | Location | Reuse for Task 2.1 |
|-----------|----------|-------------------|
| OAuth utilities | `src/lib/connectors/oauth/utils.ts` | Reused for state, PKCE, scope inspection |
| Encryption | `src/lib/security/encryption.ts` | Reused via `socialCredentialService` |
| Tenant context | `src/lib/tenancy/context.ts`, `guards.ts` | Reused for brand-scoped operations |
| Audit logging | `src/server/services/audit-service.ts` | Reused with `social.*` actions |
| API handler pattern | `src/lib/api/handler.ts` | Mirrored in `social-handler.ts` |

**Decision:** Social connections use a dedicated domain (`SocialConnection`, `SocialAccount`) rather than extending `ConnectorAccount`. The generic connector framework remains for analytics/CRM integrations; social OAuth has distinct account-selection and capability requirements.

## Encryption Service

- AES-256-GCM via `encryptSecret` / `decryptSecret`
- Separate encryption for access and refresh tokens
- Key rotation supported via `CredentialRotationEvent` and `rotateStoredCredentials`
- **Confirmed:** tokens never returned to browser or logged

## Tenant Context

- All social models include `organisationId`, `projectId`, `brandId`
- API routes require `organisationId` query param or header
- `brandService.getById()` validates brand belongs to organisation
- OAuth state binds `userId`, `organisationId`, `projectId`, `brandId`

## RBAC

New permissions added in `src/lib/tenancy/permissions.ts`:

| Permission | OWNER | ADMIN | MARKETER | ANALYST | VIEWER |
|------------|-------|-------|----------|---------|--------|
| `socialConnections.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `socialConnections.create` | ✓ | ✓ | ✓ | — | — |
| `socialConnections.reconnect` | ✓ | ✓ | ✓ | — | — |
| `socialConnections.disconnect` | ✓ | ✓ | ✓ | — | — |
| `socialAccounts.assign` | ✓ | ✓ | ✓ | — | — |

All enforcement is server-side via `withApiHandler` permission checks.

## WorkspacePreference

- Social connections are brand-scoped
- UI uses `preference.currentBrandId` from workspace provider
- No changes to `WorkspacePreference` model required

## Brand Model

- `Brand` has relations to `SocialConnection`, `SocialAccount`, `OAuthAuthorisationState`
- One connection per provider per brand (`@@unique([brandId, provider])`)

## Audit Logging

Social audit events (no tokens or codes in metadata):

- `social.connectionStarted`
- `social.connectionCompleted`
- `social.connectionFailed`
- `social.connectionReauthorised`
- `social.connectionDisconnected`
- `social.accountAssigned`
- `social.permissionsChanged`

## Environment Validation

Provider credentials validated via `getServerEnv()` and `getIntegrationStatus()`:

| Provider | Env vars |
|----------|----------|
| Instagram / Facebook | `META_APP_ID`, `META_APP_SECRET` |
| LinkedIn | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` |
| YouTube | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| X | `X_CLIENT_ID`, `X_CLIENT_SECRET` |

**Confirmed:** all provider secrets are server-only (not `NEXT_PUBLIC_*`).

## Feature Flags / Availability

Provider maturity levels in `src/lib/social/registry.ts`:

- `available` — credentials configured, adapter registered
- `beta` — TikTok, X (adapter registered, credentials required)
- `not_configured` — env vars missing
- `unavailable` — adapter not registered

Providers are never shown as operational when credentials are absent.

## Out of Scope (Task 2.1)

- Publishing, scheduling, content generation
- Social analytics, comments, DMs, lead capture
- Real provider API implementations (mock adapters used; production adapters to follow)

## Launch Readiness

Task 2.1 delivers secure OAuth foundation with account selection and capability discovery. Production use requires configuring provider credentials per environment.
