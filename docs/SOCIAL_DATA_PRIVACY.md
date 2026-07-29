# Social Data Privacy

Privacy considerations for Stage 2 Social Media AI data handling.

## Data categories

| Category | Examples | Storage | Retention |
|----------|----------|---------|-----------|
| OAuth tokens | Access/refresh tokens | `SocialConnectionCredential` (encrypted) | Until disconnect or rotation |
| Account metadata | Handle, profile image URL, follower count | `SocialAccount` | Until disconnect |
| Published content | Captions, hashtags, media references | `ContentItem`, `ContentVariant` | Until archived/deleted |
| Publishing records | Provider post IDs, permalinks, attempts | `PublishingJob`, `PublishingAttempt` | Indefinite (audit trail) |
| Analytics metrics | Impressions, engagement, reach | `SocialPostMetric`, `SocialMetricSnapshot` | Per sync; no automatic purge |
| Comments/messages | Not collected on `main` | N/A | Social inbox not implemented |
| AI generation context | Brand knowledge, prompts | `ContentRevision`, AI usage logs | Per content lifecycle |

## Encryption

- Social OAuth tokens encrypted at rest with AES-256-GCM (`ENCRYPTION_KEY`)
- Encryption key version tracked per credential row
- Key rotation supported without plaintext exposure
- Tokens never included in API responses, logs, or client-side state

## PII handling

- Social profile data (display name, handle) stored as account metadata for UI display
- No end-user (audience) PII collected by the platform on `main`
- Publishing captures only the brand's own content and provider-assigned post IDs
- Analytics stores aggregated metrics, not individual audience member data

## Third-party data flows

| Provider | Data sent | Purpose |
|----------|-----------|---------|
| Meta (Instagram/Facebook) | Content, media URLs, tokens | Publishing and insights |
| TikTok | Video content, posting settings, tokens | Publishing and insights |
| LinkedIn | Text, images, documents, tokens | Publishing and insights |
| Google (YouTube) | Video, metadata, tokens | Publishing and insights |
| X | Text, media, tokens | Publishing and insights |
| AI providers (OpenAI, etc.) | Brand context, prompts | Content generation |

All provider calls originate server-side. Client never holds provider tokens.

## Tenant isolation

- All social data scoped to `organisationId` → `projectId` → `brandId`
- Cross-tenant access prevented by server-side scope checks
- Disconnect flow deletes encrypted credentials

## Data subject rights (GDPR)

| Right | Current support |
|-------|-----------------|
| Access | Manual — export via database query per tenant |
| Rectification | Supported via content editing and account reconnect |
| Erasure | Partial — disconnect removes credentials; content/archive deletion manual |
| Portability | Partial — content export not automated |
| Restriction | Supported via account disconnect and publishing kill switches |

**Gap:** Automated data-subject request workflow not implemented. Erasure of analytics metrics requires manual database operation.

## Retention policy (recommended)

| Data | Recommended retention | Current behaviour |
|------|----------------------|-------------------|
| OAuth tokens | Until disconnect | Deleted on disconnect |
| Publishing attempts | 12 months | Indefinite |
| Analytics snapshots | 24 months | Indefinite |
| AI usage logs | 12 months | Per Stage 1 AI cost controls |
| Audit logs | 24 months | Indefinite |

Implement automated retention purge before general-availability launch.

## Logging

- Structured logs redact tokens and secrets
- Request IDs (`x-request-id`) correlate API activity
- Publishing and analytics counters logged without PII
- Do not paste tokens or customer content into incident tickets

## Children's data

The platform is not designed for accounts targeting users under 16. Provider terms (especially TikTok) impose additional restrictions — verify during provider app review.

## Related documents

- `docs/AI_PRIVACY.md` — AI-specific privacy controls
- `docs/SOCIAL_OAUTH_SECURITY.md` — OAuth flow security
- `docs/STAGE_2_SECURITY_REVIEW.md` — Security review
- `docs/BACKUP_RECOVERY.md` — Backup and recovery
