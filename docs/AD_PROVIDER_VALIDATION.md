# Ad Provider Validation

`AdvertisingCreativeProviderValidation` stores **local pre-check** results only.

## Disclaimer

> Local pre-check only. This is not provider approval. Final acceptance is determined by the advertising platform.

## Validated rules

- Field lengths vs format text limits
- Required fields and prohibited combinations
- Creative ratios and asset count
- File type, size, and video duration (warnings)
- CTA availability
- Destination requirement

## Statuses

- `PASSED` — no blocking issues
- `WARNING` — non-blocking advisories (audio, subtitles, duration)
- `FAILED` — blocking errors (length, missing destination, compliance)

## Usage

POST `action: "validate-provider"` with `provider` and `formatType`.

Results surfaced at `/advertising/creatives/[creativeId]/validation`.

## Task 5.2 scope

Validation is client-side rule engine only. Live provider API validation deferred to Task 5.3+.
