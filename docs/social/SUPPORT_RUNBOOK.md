# Organic Social Support Runbook

## Connection issues

| Symptom | Check | Action |
|---------|-------|--------|
| Connect fails | `META_APP_ID` / `META_APP_SECRET` | Verify env; see `docs/providers/META_SETUP.md` |
| No IG accounts | Page not linked to IG Business | Customer must link in Meta Business Suite |
| REQUIRES_REAUTH | `ProviderConnection.status` | Integrations → Reconnect |
| Permissions missing | `/scopes` endpoint | Re-authorize with required scopes |

## Publishing failures

| Error | Category | Customer action |
|-------|----------|-----------------|
| MEDIA_NOT_READY | Preflight | Approve assets; wait for processing |
| PROVIDER_AUTH_FAILED | Reauth | Reconnect account |
| RATE_LIMITED | Retryable | Wait; automatic backoff |
| UNSUPPORTED_MEDIA | Content | Fix dimensions/format |

## Duplicate posts

- Jobs use idempotency keys: `publication:{id}:execute`
- Advisory lock on `PublishingJob.id`
- Do not manually re-execute without retry endpoint

## Disconnect

1. Integrations → Disconnect
2. Tokens revoked locally (+ remote revoke attempted)
3. New publications blocked
4. Historical `Publication` + `PublicationMetric` retained per retention policy

## Observability (safe fields only)

Log: `requestId`, `providerKey`, `operation`, HTTP status, normalized error category, duration.

**Never log:** access tokens, authorization codes, client secrets, full provider response bodies.

## Escalation

1. Check publication attempts in DB (`PublicationAttempt`)
2. Check provider audit events
3. Verify Meta app mode (dev vs live)
4. For App Review blockers see `META_SCOPES_AND_APP_REVIEW.md`
