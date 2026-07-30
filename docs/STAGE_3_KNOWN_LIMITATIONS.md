# Stage 3 Known Limitations

## Data sources

- Stripe revenue requires environment configuration
- CRM and internal event revenue adapters are stubs
- GA4 dashboard is reconciliation-focused, not full analytics UI
- Email performance is an extension point

## Analytics

- Cross-currency metrics are not normalised to reporting currency
- Seasonal anomaly detection not implemented (percentage threshold only)
- Executive project/brand comparison uses separate API calls
- Funnel templates for Cresco brands only (`organisation.slug === 'cresco-group'`)

## AI analyst

- Scheduled briefs are on-demand only (no cron scheduler)
- Query planner uses pattern matching, not LLM-generated SQL
- Action creation supports content brief and experiment; other action types record intent only
- Deterministic fallback used when AI validation fails

## Attribution

- Cross-device journeys may be incomplete
- Model choice affects credit assignment

## Revenue

- Chargeback handling is extension point
- Line items from Stripe not fully persisted during sync
- LTV requires explicit methodology configuration

## General

- `/ai-agents` page remains placeholder (analyst is at `/analyst`)
- No Redis cache; executive uses in-memory TTL cache per instance
