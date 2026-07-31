# Stage 5 Data Accuracy Review

Audit of advertising metric accuracy across Tasks 5.1–5.9.

## Metric handling

| Metric | Source | Accuracy notes |
|--------|--------|----------------|
| Spend | Provider reporting | Account currency preserved; micros conversion for Google |
| Impressions | Provider reporting | May include invalid traffic per provider definition |
| Clicks | Provider reporting | Provider-specific click definitions differ |
| CTR | Derived | `clicks / impressions × 100` — deterministic |
| CPC | Derived | `spend / clicks` — undefined when clicks = 0 |
| CPM | Derived | `spend / impressions × 1000` |
| Conversions | Provider + attribution | Attribution model must be disclosed |
| CPA | Derived | `spend / conversions` |
| Revenue | Provider / CRM | Attribution window affects totals |
| ROAS | Derived | `revenue / spend` — blocked when spend = 0 |
| Currency conversion | Budget governance | FX rate required; missing-rate warnings emitted |
| Attribution windows | Per provider | Google 30-day default; Meta 1/7-day click + view |
| Experiment results | Observations | Normal-approximation CI; validity prerequisites required |
| Pacing | Budget governance | Linear time-weighted; deterministic formulas |
| Provider state | Sync operations | Drift detection via `detectProviderStateDrift` |

## Known accuracy limitations

1. **Cross-provider comparison** — Attribution definitions differ; must show model and window
2. **Mixed currency** — Totals require explicit FX rate; missing rates exclude amounts
3. **Delayed conversions** — Provider reporting lag 24–72h; pacing may over/under-estimate
4. **Deleted campaigns** — Historical observations retained; sync may show stale state
5. **Refunds** — Not automatically netted from spend observations
6. **Stale metrics** — Blocked for optimisation when >48h old
7. **Low volume** — Findings suppressed below minimum impression threshold

## Safeguards

- Evidence packages include metric definitions
- Experiment validity checks flag insufficient volume, tracking failure, stale data
- Budget alerts for stale provider data and unexpected provider budget changes
- Optimisation guardrails block recommendations on stale or insufficient data

## Recommendations for operators

- Reconcile spend weekly against provider billing
- Do not compare conversion totals across providers without normalising attribution
- Wait 48h after campaign changes before acting on performance data
- Use experiment validity panel before making decisions
