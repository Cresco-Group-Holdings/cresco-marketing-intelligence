# Ad Provider Incident Runbook

## Provider outage

1. Check provider status page (Google, Meta, LinkedIn, TikTok)
2. Set `ADVERTISING_EMERGENCY_SHUTDOWN=true` if mutations in flight
3. Monitor `launch_failure` metric
4. Do not retry launches until provider confirms recovery
5. Review partial mutations via `docs/AD_MUTATION_RECOVERY.md`

## Rate limiting

**Symptoms**: `RESOURCE_EXHAUSTED` (Google), `X-Business-Use-Case-Usage` (Meta)

**Actions**:
1. Implement exponential backoff (already in error recovery modules)
2. Reduce sync frequency
3. Contact provider support if persistent

## Account suspension

**Symptoms**: Provider returns policy violation or account disabled

**Actions**:
1. Trigger `ACCOUNT_FREEZE` emergency incident
2. Do not attempt further mutations
3. Review creative compliance findings
4. Contact provider support with account ID
5. Document in `AdvertisingSpendIncident`

## Policy rejection

**Symptoms**: Ad disapproved after launch

**Actions**:
1. Review creative compliance scan results
2. Create new creative variant
3. Re-run compliance check
4. Submit new mutation plan (requires fresh approvals)

## OAuth token expiry

See `docs/AD_OAUTH_RECOVERY.md`
