# Advertising Readiness

The readiness engine runs **deterministic checks** before review and launch.

## Check types

| Check | Severity |
|-------|----------|
| missing_objective | HIGH |
| missing_budget | HIGH |
| missing_dates | HIGH |
| missing_audience | HIGH |
| missing_destination | HIGH |
| unverified_domain | MEDIUM |
| missing_primary_conversion | HIGH |
| unverified_tracking | MEDIUM |
| missing_approved_creative | HIGH |
| invalid_utm | LOW |
| provider_account_unavailable | HIGH |
| currency_mismatch | MEDIUM |
| compliance_review_missing | HIGH |
| required_approval_missing | HIGH |
| creative_format_incompatible | MEDIUM |
| unsupported_provider_objective | HIGH |

## Statuses

- `NOT_READY` — blocking issues
- `NEEDS_ATTENTION` — non-blocking warnings
- `READY_FOR_REVIEW` — all blocking checks pass
- `READY_TO_LAUNCH` — all checks pass including approvals

## Conversion tracking

Conversion goals are **not** marked ready unless `trackingVerified` is true on `AdvertisingCampaignConversionGoal`. Task 5.1 does not auto-verify tracking.

## Usage

POST `action: "readiness"` on the plan API. Results are persisted to `AdvertisingCampaignReadinessCheck` and surfaced in `/advertising/plans/[planId]/readiness`.
