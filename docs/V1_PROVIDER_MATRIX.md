# V1 Provider Matrix

Consolidated capability verification for all external providers across Stages 1–6. Unverified capabilities are **disabled**, never simulated.

## Social publishing (Stage 2)

| Platform | Publish | Analytics | OAuth | Notes |
|----------|---------|-----------|-------|-------|
| Instagram | ✅ | ✅ | ✅ | Rate limits; media type restrictions |
| TikTok | ✅ | ✅ | ✅ | Rate limits; content policy |
| LinkedIn | ✅ | ✅ | ✅ | Organisation page required |
| Facebook | ✅ | ✅ | ✅ | Page access required |
| X (Twitter) | ⚠️ | ⚠️ | ✅ | API tier dependent |

Reference: `docs/SOCIAL_CAPABILITIES.md`

## Analytics connectors (Stage 3)

| Provider | Sync | Webhooks | OAuth | Notes |
|----------|------|----------|-------|-------|
| GA4 | ✅ | N/A | ✅ | Metric reconciliation documented |
| Google Search Console | ✅ | N/A | ✅ | 2–3 day delay |
| Google Ads (read) | ✅ | N/A | ✅ | Read-only for analytics |
| Meta Ads (read) | ✅ | N/A | ✅ | Read-only for analytics |
| LinkedIn Ads (read) | ✅ | N/A | ✅ | Read-only |
| TikTok Ads (read) | ✅ | N/A | ✅ | Read-only |
| Stripe | ✅ | ✅ | API key | Requires `brand_id` metadata |

## SEO data sources (Stage 4)

| Source | Available | Notes |
|--------|-----------|-------|
| First-party crawler | ✅ | No JS rendering |
| Google Search Console | ✅ | Query/page data |
| Licensed rank APIs | ✅ | Provider-dependent |
| Manual CSV import | ✅ | |
| Competitor crawl | ✅ | Bounded; excerpt truncation |

Reference: `docs/RANK_DATA_SOURCES.md`

## Advertising management (Stage 5)

### Google Ads

| Capability | Available | Notes |
|------------|-----------|-------|
| OAuth | ✅ | Developer token required |
| Search campaigns | ✅ | Paused launch default |
| Display / PMax / Video / Shopping | ❌ | Not in scope |
| Responsive search ads | ✅ | |
| Conversion tracking | ✅ | |
| Smart bidding | ❌ | Manual CPC only |
| Policy review polling | ❌ | Client-side validation |
| Mutations | ✅ | 8 approval gates |

### Meta Ads

| Capability | Available | Notes |
|------------|-----------|-------|
| OAuth | ✅ | ads_read, ads_management |
| App review (non-owned) | ❌ | Beta on owned accounts |
| Traffic / conversions | ✅ | |
| Lead generation | ✅ | |
| CAPI | ✅ | |
| Advantage+ / Catalog | ❌ | Not verified |
| Lookalike audiences | ❌ | Upload deferred |
| Mutations | ✅ | 8 approval gates |

### LinkedIn Ads

| Capability | Available | Notes |
|------------|-----------|-------|
| OAuth | ✅ | r_ads, rw_ads |
| Campaign creation | ✅ | |
| Sponsored content | ✅ | Single-image, video |
| Document ads | ❌ | Not verified |
| Matched audiences | ❌ | Upload deferred |
| Mutations | ✅ | 8 approval gates |

### TikTok Ads

| Capability | Available | Notes |
|------------|-----------|-------|
| OAuth | ✅ | Advertiser access |
| Campaign creation | ✅ | |
| Short video ads | ✅ | |
| Spark Ads | ❌ | Creator auth not verified |
| Pixel tracking | ✅ | |
| Sandbox | ❌ | Separate app tier |
| Mutations | ✅ | 8 approval gates |

Reference: `docs/STAGE_5_PROVIDER_MATRIX.md`

## Email providers (Stage 6)

| Capability | SES | SendGrid | Mailgun | Postmark | Resend | Custom SMTP |
|------------|-----|----------|---------|----------|--------|-------------|
| Transactional | ✅ | ✅ | ✅ | ✅ | ✅ | Depends |
| Marketing bulk | ✅ | ✅ | ✅ | Limited | ✅ | Depends |
| Domain verification | ✅ | ✅ | ✅ | ✅ | ✅ | Manual |
| Webhooks | ✅ | ✅ | ✅ | ✅ | ✅ | None |
| Suppression sync | ✅ | ✅ | ✅ | ✅ | ✅ | Manual |
| Open/click tracking | ✅ | ✅ | ✅ | ✅ | ✅ | No |
| EU data residency | ✅ | ✅ | ✅ | ✅ | ✅ | Self-hosted |

Reference: `docs/EMAIL_PROVIDER_CAPABILITIES.md`

## AI providers (Stage 1+)

| Provider | Text | Vision | Structured output | Notes |
|----------|------|--------|-------------------|-------|
| OpenAI | ✅ | ✅ | ✅ | Primary |
| Anthropic | ✅ | ✅ | ✅ | Alternative |
| Google (Gemini) | ✅ | ✅ | ✅ | Alternative |

All AI calls route through `AIRequestService` with redaction, cost tracking, and rate limits.

## Payment (Stage 3)

| Capability | Stripe | Notes |
|------------|--------|-------|
| Webhooks | ✅ | HMAC signature verification |
| Customer sync | ✅ | Requires brand metadata |
| Subscription MRR | ✅ | |
| Refunds | ✅ | Separate records |

## Capability gate implementation

| Module | Registry location |
|--------|------------------|
| Advertising | `src/lib/advertising-providers/capability-gates.ts` |
| Email | `src/lib/email/provider-registry.ts` |
| Social | `src/lib/social/provider-registry.ts` |
| SEO | `src/lib/seo/quotas.ts` |

UI should call capability gate functions to show unavailable features rather than failing at runtime.

## App review requirements

| Provider | Review required for | Beta workaround |
|----------|--------------------|--------------------|
| Meta Ads | Non-owned ad accounts | Owned test/sandbox accounts |
| Google Ads | Production spend (developer token tier) | Test accounts |
| TikTok Ads | Production API access | Low-spend production |
| LinkedIn Ads | Production API access | Test accounts |
| Instagram/Facebook | Advanced permissions | Developer mode accounts |

## Provider incident response

- Advertising: `docs/AD_PROVIDER_INCIDENT_RUNBOOK.md`
- SEO: `docs/SEO_PROVIDER_RUNBOOK.md`
- OAuth recovery: `docs/AD_OAUTH_RECOVERY.md`
- Email: Check provider status page; review webhook processing
