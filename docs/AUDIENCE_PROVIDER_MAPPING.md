# Audience Provider Mapping

`AdvertisingAudienceProviderMapping` prepares provider-specific configuration **without activation**.

## Providers

| Provider | Type | Min size | Retention |
|----------|------|----------|-----------|
| GOOGLE_ADS | CUSTOMER_MATCH | 1,000 | 540 days |
| META | CUSTOM_AUDIENCE | 100 | 180 days |
| LINKEDIN | MATCHED_AUDIENCE | 300 | 180 days |
| TIKTOK | CUSTOM_AUDIENCE | 1,000 | 180 days |

## Stored fields

- `providerAudienceType`
- `eligibilityStatus`
- `minimumSizeRule`
- `requiredIdentifierType` (e.g. HASHED_EMAIL_OR_PHONE)
- `supportedRetentionDays`
- `policyWarnings`
- `isActivated` — always `false` in Task 5.3

## Eligibility checks

`checkProviderEligibility()` validates:

- Eligible count vs minimum size
- Retargeting window vs supported retention
- Adds warning: "Mapping is preparatory only — audience not activated externally."

## Disclaimer

Provider match rates and reach are **not fabricated**. `AdvertisingAudienceEstimate.providerMatchNote` marks the extension point for future provider API integration.
