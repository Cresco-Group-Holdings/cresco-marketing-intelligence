# Meta Ads Error Recovery

| Kind | Retryable | Re-approval | Action |
|---|---|---|---|
| `EXPIRED_TOKEN` | No | No | Reconnect Meta OAuth |
| `PERMISSION_LOST` | No | Yes | Re-grant `ads_management` |
| `PAGE_ACCESS_LOST` | No | Yes | Re-authorise Page |
| `INSTAGRAM_MISMATCH` | No | Yes | Re-select Instagram business account |
| `POLICY_REJECTION` | No | Yes | Update creative/targeting |
| `PARTIAL_MUTATION` | Yes | No | Retry failed steps only |
| `TIMEOUT` | Yes | No | Verify provider state first |
| `DUPLICATE_RETRY` | No | No | Sync existing resources |
| `ACCOUNT_RESTRICTED` | No | No | Resolve in Business Manager |
| `RATE_LIMIT` | Yes | No | Exponential backoff |
| `STALE_APPROVAL` | No | Yes | Rebuild mutation plan |

## Partial mutation

Campaign may be created while ad set fails. `AdvertisingMetaAdsProviderResource` records per-step status; retry uses same `idempotencyKey`.

## Policy rejection

Launch status `POLICY_REJECTED` with `policyRejectionReason`. Remediation via `/advertising/meta/review`.
