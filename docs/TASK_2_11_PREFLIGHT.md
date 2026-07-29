# Task 2.11 pre-flight

Audit date: 2026-07-29.

## Existing foundations

- `SocialConnection` and `SocialAccount` are tenant-scoped and own encrypted provider credentials. Analytics must use `socialCredentialService`, not duplicate connector credentials.
- Published provider identifiers live on `PublishingJob.publishedMediaId`; X thread IDs live in `providerUploadState.postIds`. The join path is `ContentItem → ContentVariant → ContentSchedule → PublishingJob`.
- Social capability detection already includes `READ_INSIGHTS`, but provider OAuth scope configuration remains provider-dependent.
- Connector sync supplies useful retry, cursor, partial-failure, and idempotency patterns. Social analytics remains a separate domain because social OAuth is represented by `SocialConnection`.
- Worker requests use timing-safe bearer authentication through `isAuthorisedWorkerRequest`.
- Tenant enforcement uses `organisationId`, `projectId`, and `brandId` on every persisted domain record.

## Implementation decisions

1. Store only provider-returned observations. Missing fields are unavailable, not zero.
2. Keep provider source fields in a canonical metric registry and raw provider metadata on snapshots.
3. Treat reach, impressions, views, reactions, followers, and subscribers as distinct metrics.
4. Persist a durable `SocialAnalyticsSync` with cursor, retries, partial errors, and idempotent per-post/account snapshots.
5. Resolve published IDs through completed publishing jobs; parse X thread IDs independently.
6. Calculate derived metrics only when compatible numerator and denominator observations exist.
7. Grant analytics read access to analysts while restricting manual sync to owners/admins.

## Provider limitations

Provider insight scopes, metric availability, retention windows, account types, and commercial entitlements vary. Adapters omit unavailable metrics and persist provider errors without substituting another metric. The existing provider capability documents remain authoritative for configured app access.
