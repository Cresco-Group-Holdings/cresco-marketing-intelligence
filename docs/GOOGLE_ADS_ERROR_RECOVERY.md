# Google Ads Error Recovery

## Error classification

| Kind | Retryable | Re-approval required |
|---|---|---|
| `PARTIAL_FAILURE` | Yes | No |
| `TIMEOUT_AFTER_MUTATION` | Yes (verify state first) | No |
| `DUPLICATE_RETRY` | No | No — sync existing |
| `PERMISSION_LOST` | No | Yes |
| `ACCOUNT_SUSPENDED` | No | Yes |
| `POLICY_REJECTION` | No | Yes |
| `QUOTA_EXHAUSTED` | Yes (backoff) | No |
| `STALE_APPROVAL` | No | Yes |
| `STATE_MISMATCH` | No | Investigate |

## Timeout handling

After timeout, check `AdvertisingGoogleAdsProviderResource` for created resources before retrying. Use same `idempotencyKey` to prevent duplicates.

## Permission loss

Set `AdvertisingGoogleAdsAccount.status = PERMISSION_LOST` and block launches until reconnect.

## Stale approval

Launch status `STALE_APPROVAL` when executed plan hash differs from approval hash. Rebuild mutation plan and re-run all gates.

## Sync recovery

On successful campaign creation, upsert `MarketingCampaign` with `providerMetadata.launchId` and `mutationPlanHash` for warehouse reconciliation.
