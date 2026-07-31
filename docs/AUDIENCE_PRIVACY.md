# Audience Privacy

## Consent checks

`AdvertisingAudienceConsentPolicy` stores:

- `marketingConsentRequired` — default true
- `dataSources` — permitted data sources
- `retentionDays` — retention limit
- `permittedPurpose` — advertising purpose description
- `customerListEligible` — whether customer list upload is permitted
- `deletionExcluded` — exclude deleted identities (default true)
- `geoRestrictions` — blocked countries/regions

## Identity eligibility

`isIdentityEligibleForAudience()` checks:

1. Not deleted or suppressed
2. Marketing consent (if required)
3. Geographic restrictions
4. Customer list eligibility for CRM sources

## Principles

- No identities without eligible consent basis
- Deleted identities always excluded when `deletionExcluded` is true
- Provider reach is **not** estimated — only first-party eligible counts

## Data sources

CRM, LEADS, CUSTOMERS, WEBSITE_EVENTS, CONTENT_ENGAGEMENT, PRODUCT_USAGE, EMAIL_ACTIVITY, CAMPAIGN_INTERACTIONS, GEOGRAPHIC, DECLARED_INTERESTS, PROVIDER_NATIVE
