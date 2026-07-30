# Advertising Objectives

Each plan supports objectives aligned to `AdvertisingPlanObjectiveType`:

- Brand: `BRAND_AWARENESS`, `REACH`, `VIDEO_VIEWS`
- Consideration: `WEBSITE_TRAFFIC`, `ENGAGEMENT`
- Conversion: `LEAD_GENERATION`, `DEMO_REQUESTS`, `APP_SIGNUPS`, `TRIAL_STARTS`, `SUBSCRIPTIONS`, `PURCHASES`
- Retention: `RETARGETING`, `CUSTOMER_RETENTION`
- Custom: `CUSTOM`

## Required definition fields

`AdvertisingCampaignObjective` stores:

| Field | Purpose |
|-------|---------|
| primaryConversion | Main success event |
| supportingMetrics | Secondary KPIs |
| successCriteria | Human-defined success thresholds |
| targetAudienceSummary | Intended audience |
| destinationSummary | Where traffic should land |
| attributionExpectations | Expected attribution model |
| measurementLimitations | Known tracking gaps |

## Principles

- Objectives do **not** promise outcomes.
- AI proposals must include evidence, assumptions, uncertainty, and human review recommendations.
- Provider-specific objective compatibility is validated in readiness checks.

## Linking

Objectives may reference `MarketingObjective` from the brand knowledge base for consistency with organic and content strategy.
