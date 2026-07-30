# On-Page SEO Limitations

## What this system does NOT do

1. **Modify production pages** — all output is advisory
2. **Guarantee ranking improvements** — comparisons and recommendations include explicit disclaimers
3. **Replace human judgment** — overrides and manual review are first-class
4. **Use a single readability formula as truth** — indicators are transparent and advisory
5. **Enforce keyword stuffing** — over-optimisation is flagged, not encouraged

## Data limitations

| Input | Limitation |
|-------|------------|
| Crawl snapshot | May be stale (>14 days warns user) |
| Search Console | Only available when synced |
| Competitor evidence | No licensed SERP data assumed |
| Long-form draft | Not yet published — technical checks limited |
| AI semantic review | Requires AI provider; may be skipped |

## Comparison limitations

Before/after comparisons show:
- Resolved vs new issue rule IDs
- Open finding counts

They do NOT:
- Predict traffic or ranking changes
- Account for algorithm updates
- Replace A/B testing

## Override lifecycle

Users may override findings with a documented reason. Overridden findings are excluded from blocking workflows but retained for audit trail.

## Tenant isolation

All audits, findings, and recommendations are scoped to `organisationId` + `brandId`. Cross-tenant access is prevented at the service layer.
