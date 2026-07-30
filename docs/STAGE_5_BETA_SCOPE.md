# Stage 5 Beta Scope

## In scope for beta

- Campaign planning with versioning and readiness gates
- Creative studio with compliance scanning (no auto-publish)
- Audience planning with consent and sensitive-targeting checks
- Google Search campaign draft, validation, and controlled launch
- Meta campaign draft, validation, and controlled launch
- LinkedIn and TikTok campaign draft, validation, and controlled launch
- A/B experiments with validity checks and human decisions
- Budget pacing, alerts, change requests, and emergency controls
- AI optimisation reviews with evidence and approval-gated actions

## Out of scope for beta

- Audience upload/activation to providers
- Live provider policy review polling
- Cross-currency FX automation for pacing totals
- Provider-side automatic emergency pause
- Spark Ads, Document Ads, Performance Max, Advantage+
- Autonomous campaign launch or budget increase
- Multi-brand portfolio optimisation across organisations

## Recommended beta accounts

| Provider | Account type | Spend limit |
|----------|-------------|-------------|
| Google Ads | Test account or low-spend production | Provider minimum + org hard limit |
| Meta | Owned sandbox or test ad account | $50/day recommended max |
| LinkedIn | Test ad account | Provider minimum |
| TikTok | Production advertiser (low spend) | $50/day recommended max |

## Role requirements

| Action | Minimum role |
|--------|-------------|
| View plans, creatives, audiences | VIEWER |
| Create drafts, run experiments | MARKETER |
| Launch campaigns, approve budgets | ADMIN |
| Emergency controls | ADMIN |
| Organisation policy changes | OWNER |

## Spending limits

- Enforce organisation `AdvertisingBudgetPolicy.hardLimitPct` (default 50%)
- Daily change limit: 20% without escalation
- Emergency pause on overspend risk alerts (manual trigger)
