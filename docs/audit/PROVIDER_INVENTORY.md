# Provider Inventory

**Main SHA:** `8910740` | **Audit date:** 2026-08-16

---

## Summary

| Category | Count |
|----------|-------|
| Catalogue definitions | 30 |
| Enabled in production registry | 2 (`csv-import`, `first-party-crawler`) + 3 mocks (non-prod) |
| Real platform adapters | 1 (Resend) |
| Real adapters outside platform-registry | 10+ (social publish, paid ads, email, analytics) |
| Mock platform adapters | 3 |
| OAuth providers (definitions) | 13 |
| OAuth token exchange | **ALL MOCK** |

---

## REAL PROVIDERS

| Name | Type | Auth | Capabilities | Status |
|------|------|------|--------------|--------|
| **Resend** | EMAIL | API_KEY | SEND, BATCH, WEBHOOKS, DOMAIN | Real HTTP adapter; definition `enabled: false` |
| **Instagram** (publish) | SOCIAL | OAuth tokens | PUBLISH | Real HTTP in `instagram-publishing-adapter.ts`; connect MOCK |
| **Facebook** (publish) | SOCIAL | OAuth | PUBLISH | Real HTTP |
| **LinkedIn** (publish) | SOCIAL | OAuth | PUBLISH | Real HTTP |
| **TikTok** (publish) | SOCIAL | OAuth | PUBLISH | Real HTTP |
| **YouTube** (publish) | SOCIAL | OAuth | PUBLISH | Real HTTP |
| **X** (publish) | SOCIAL | OAuth | PUBLISH | Real HTTP |
| **Google Ads** | ADVERTISING | OAuth | MANAGE, REPORT | Real mutate client |
| **Meta Ads** | ADVERTISING | OAuth | MANAGE, REPORT | Real mutate client |
| **LinkedIn Ads** | ADVERTISING | OAuth | MANAGE, REPORT | Real adapter |
| **TikTok Ads** | ADVERTISING | OAuth | MANAGE, REPORT | Real adapter |
| **Stripe** | PAYMENTS | API_KEY | BILLING | Real when env configured |
| **Social analytics pull** | ANALYTICS | OAuth | METRICS | Real per-provider HTTP |
| **Paid ads reporting sync** | ADVERTISING | OAuth | REPORT | Real in `paid-ads-reporting-adapters.ts` |

---

## PARTIAL PROVIDERS

| Name | What's real | What's mock/missing |
|------|-------------|---------------------|
| All OAuth catalogue entries (meta, google-ads, etc.) | Auth URL builders, definitions, credential vault | Token exchange, refresh, revoke; `enabled: false` |
| Stage 13 sync providers | API routes, job model, UI panels | `mock-sync-adapter` for all data pages |
| Email (SendGrid, Postmark, SES, SMTP) | Adapter code in `lib/email/providers/` | Not in platform-registry; not primary path |
| GA4 / GSC | Connector OAuth + sync services | Depends on connector tokens + scheduler |

---

## MOCK PROVIDERS

| Name | Type | Used by |
|------|------|---------|
| `mock-social` | SOCIAL | Platform registry, publication gateway, **social OAuth connect** |
| `mock-advertising` | ADVERTISING | Platform registry, publication gateway |
| `mock-crm` | DATA | Platform registry |
| `mock-sync` (all Stage 13 keys) | SYNC | `sync-adapter-registry.ts` |
| OAuth token adapter | OAUTH | `oauth-adapter-registry.ts` — all 13 keys |
| MockAIProvider | AI | Default LLM without API keys |
| MockImageProvider | AI | All image generation |
| MockSocialInboxAdapter | INBOX | All 6 platforms |

---

## PLANNED PROVIDERS (definition only, enabled: false)

`meta`, `instagram`, `facebook`, `linkedin`, `tiktok`, `x`, `youtube`, `pinterest`, `google-analytics`, `google-search-console`, `google-ads`, `meta-ads`, `linkedin-ads`, `tiktok-ads`, `microsoft-ads`, `hubspot`, `mailchimp`, `slack`, `sendgrid`, `postmark`, `amazon-ses`, `smtp`, `stripe` (catalogue), `licensed-rank-provider`

---

## Capability matrix (platform-registry)

| Provider | READ | WRITE | PUBLISH | ANALYTICS | WEBHOOKS | TOKEN REFRESH | RATE LIMIT | RETRY | ERROR NORM |
|----------|------|-------|---------|-----------|----------|---------------|------------|-------|--------------|
| mock-social | ✓ | ✓ | ✓ | — | — | Simulated | ✓ | ✓ | ✓ |
| mock-advertising | ✓ | ✓ | — | ✓ | — | Simulated | ✓ | ✓ | ✓ |
| mock-crm | ✓ | — | — | — | ✓ | — | ✓ | ✓ | ✓ |
| resend | ✓ | ✓ | — | — | ✓ | N/A | ✓ | ✓ | ✓ |
| Real social publish | ✓ | ✓ | ✓ | — | — | meta-credential-adapter | ✓ | ✓ | ✓ |
| OAuth (Stage 12) | — | — | — | — | — | **MOCK** | — | — | ✓ |

---

## OAuth / Connection audit (Phase 7)

| Control | Status | File |
|---------|--------|------|
| Authorization URL | Real when client ID set | `oauth-adapter-registry.ts` |
| Callback | Implemented | `oauth-callback-service.ts` |
| State validation | HMAC + encryption | `state-signing.ts`, `security.ts` |
| PKCE | Implemented | `pkce.ts` |
| Credential storage | AES-256-GCM | `credential-vault.ts`, `encryption.ts` |
| Token refresh | **MOCK** | `credential-refresh-service.ts` |
| Revocation (Stage 12) | Vault clear; provider call no-op | `integrations-connection-service.ts` |
| Disconnect (legacy) | Status only | `provider-connection-service.ts` |
| Scopes | Resolver present | `connection-scope-resolver.ts` |
| Tenant ownership | organisationId on connections | Prisma models |
| Audit trail | provider audit + credential audit | `provider-audit-service.ts` |
| Secret leakage protection | Redaction utilities | `credential-redaction.ts` |

**Customer connectable today:** Resend (API key), csv-import, first-party-crawler. **No real OAuth social/ad provider** without replacing mock adapters.

---

## Provider file index

```
Definitions:     src/lib/providers/definitions.ts
Capabilities:    src/lib/providers/capability-registry.ts
Platform:        src/lib/providers/platform-registry.ts
OAuth registry:  src/server/providers/oauth/oauth-adapter-registry.ts
Sync registry:   src/server/providers/sync/sync-adapter-registry.ts
Social publish:  src/lib/social/*-publishing-adapter.ts
Social connect:  src/lib/social/adapters/mock-social-adapter.ts (ONLY)
Paid ads:        src/lib/google-ads/, meta-ads/, advertising-*-ads/
Integrations UI: src/app/(dashboard)/integrations/page.tsx
```
