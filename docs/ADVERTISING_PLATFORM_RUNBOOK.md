# Advertising Platform Runbook

Operational guide for the AI Advertising Platform (Stage 5).

## Health checks

- **Readiness**: `GET /api/readiness` — includes `advertising_platform` check
- **Metrics**: `GET /api/advertising/metrics?organisationId={id}` — requires `advertisingPlans.read`
- **Emergency flag**: `ADVERTISING_EMERGENCY_SHUTDOWN=true` blocks all mutations

## Key metrics to monitor

| Metric | Alert threshold | Action |
|--------|----------------|--------|
| `launch_failure` | >10/hour | Check provider status, OAuth tokens |
| `unauthorised_mutation_attempts` | >0 | Review audit logs |
| `emergency_pauses` | >0 | Investigate spend incident |
| `provider_connection_failures` | >5/hour | Check OAuth, rate limits |
| `budget_alerts` | CRITICAL severity | Review pacing dashboard |
| `stale_approval_invalidations` | Spike | Notify users to re-approve |

## Daily operations

1. Review `/advertising/budgets/alerts` for CRITICAL alerts
2. Run daily operational optimisation review
3. Check provider connection health in Settings → Connections
4. Verify no active emergency incidents

## Weekly operations

1. Run weekly optimisation review per brand
2. Reconcile spend against provider billing
3. Review experiment validity checks
4. Audit launch approval completion rates

## Permissions reference

| Permission | Role |
|------------|------|
| `advertising*Ads.launch` | ADMIN, OWNER |
| `advertisingBudgets.emergency` | ADMIN, OWNER |
| `advertisingOptimisation.approve` | ADMIN, OWNER |
| `advertisingBudgets.approve` | ADMIN, OWNER |

## Related runbooks

- `docs/AD_PROVIDER_INCIDENT_RUNBOOK.md`
- `docs/AD_MUTATION_RECOVERY.md`
- `docs/AD_BUDGET_INCIDENT_RUNBOOK.md`
- `docs/AD_OAUTH_RECOVERY.md`
- `docs/AD_EMERGENCY_PAUSE.md`
