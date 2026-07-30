# Advertising Audiences

`AdvertisingCampaignAudiencePlan` supports structured audience planning without uploading customer lists in Task 5.1.

## Audience types

`BROAD`, `DEMOGRAPHIC`, `GEOGRAPHIC`, `INTEREST`, `JOB_ROLE`, `COMPANY`, `INDUSTRY`, `KEYWORD`, `CUSTOM_LIST`, `WEBSITE_VISITORS`, `VIDEO_VIEWERS`, `CUSTOMER_LIST`, `LOOKALIKE`, `RETARGETING`, `EXCLUSION`, `PROVIDER_SPECIFIC`

## Storage

- `logicSpec` — JSON audience logic without sensitive raw PII
- `brandAudienceId` — optional link to `BrandAudience` from knowledge base
- `isExclusion` — exclusion audiences for suppression

## Principles

- Do not upload customer lists in Task 5.1.
- Store audience definitions as structured logic, not raw personal data.
- Audience plans require separate approval (`AUDIENCE` approval type).

## Provider differences

Channel records include `unsupportedWarnings` for placement and audience capabilities that differ by provider. Readiness checks flag unsupported combinations.
