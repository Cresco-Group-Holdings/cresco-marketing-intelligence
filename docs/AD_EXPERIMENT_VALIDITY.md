# Ad Experiment Validity

Validity checks prevent misrepresenting weak or invalid experiment evidence.

## Check types

| Check | Severity | Trigger |
|---|---|---|
| `NO_RANDOMISATION` | INFO | Always — platforms may not guarantee random assignment |
| `INSUFFICIENT_VOLUME` | CRITICAL | Variant below minimum volume |
| `UNEQUAL_DELIVERY` | WARNING | Delivery ratio ≥ 3:1 |
| `VARIANT_NOT_DELIVERED` | CRITICAL | Variant received zero delivery |
| `STALE_DATA` | WARNING | Observations older than 48 hours |
| `CAMPAIGN_CHANGE_DURING_TEST` | CRITICAL | Configuration changed mid-test |
| `AUDIENCE_OVERLAP` | CRITICAL | Overlapping audiences detected |
| `TRACKING_FAILURE` | CRITICAL | Conversion tracking broken |
| `INCONSISTENT_ATTRIBUTION` | WARNING | Different attribution windows |
| `MISSING_CONVERSION_DATA` | CRITICAL | No conversion data for variant |
| `MAJOR_BUDGET_CHANGE` | CRITICAL | Budget changed significantly |
| `EARLY_STOPPING_RISK` | WARNING | Test ended before 50% of planned duration |

## Critical issues

Critical validity issues block `ADOPT_VARIANT` decisions. Analysis will not claim statistical significance when critical issues exist.

## Provider-native allocation

When using `PROVIDER_NATIVE` allocation, an additional INFO check notes that the platform controls delivery split. Do not treat this as randomised assignment.

## Remediation

Each check includes a message describing the issue. Resolve critical checks before making adoption decisions.
