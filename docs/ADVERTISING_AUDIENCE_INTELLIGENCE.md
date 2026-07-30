# Advertising Audience Intelligence

Task 5.3 introduces privacy-conscious audience planning, segmentation, and eligibility without uploading or activating audiences in provider platforms.

## Models (9)

| Model | Purpose |
|-------|---------|
| `AdvertisingAudience` | Root audience definition |
| `AdvertisingAudienceVersion` | Version snapshots |
| `AdvertisingAudienceRule` | Approved rule conditions |
| `AdvertisingAudienceSegment` | Segment logic |
| `AdvertisingAudienceEstimate` | Eligible/excluded/consent counts |
| `AdvertisingAudienceExclusion` | Exclusion rules |
| `AdvertisingAudienceConsentPolicy` | Consent and retention policy |
| `AdvertisingAudienceProviderMapping` | Provider prep mappings (not activated) |
| `AdvertisingAudienceEligibilityCheck` | Persisted eligibility results |

## Audience types

PROSPECTING, RETARGETING, CUSTOMER, LEAD, TRIAL_USER, SUBSCRIBER, CHURN_RISK, CONTENT_ENGAGER, WEBSITE_VISITOR, CONVERSION_ABANDONER, CUSTOM_RULE_BASED, PROVIDER_NATIVE, EXCLUSION

## API

- `GET/POST /api/brands/[brandId]/advertising/audiences`
- `GET/POST /api/brands/[brandId]/advertising/audiences/[audienceId]`

Actions: `generate-plan`, `add-rule`, `add-exclusion`, `update-consent`, `eligibility`, `submit-review`, `approve`, `create-version`

## UI

`/advertising/audiences`, `/new`, `/[audienceId]`, `/rules`, `/eligibility`, `/privacy`, `/history`

## Related docs

- [Audience rules](./AUDIENCE_RULES.md)
- [Privacy](./AUDIENCE_PRIVACY.md)
- [Sensitive targeting policy](./SENSITIVE_TARGETING_POLICY.md)
- [Provider mapping](./AUDIENCE_PROVIDER_MAPPING.md)
