# Google Ads Mutation Safety

## Immutable mutation plans

`AdvertisingGoogleAdsMutationPlan` records are append-only (no `updatedAt`). Each plan includes:

- Ordered operations list
- Resources created/changed summary
- Budget, account, destination snapshots
- Risk warnings
- Validation result

## Hash

SHA-256 over canonical JSON of operations (type, ref, payload). Launch execution verifies `launch.planHash === mutationPlan.planHash`.

## Idempotency

- `idempotencyKey = sha256(planId:planHash:launchVersion)`
- Provider resources keyed by `(launchId, internalRef)`
- Retries after timeout check existing `AdvertisingGoogleAdsProviderResource` before re-creating

## Validate-only first

Budget mutate uses `validateOnly: true` before launch approval gate `PROVIDER_VALIDATION` can pass.

## Partial failure

Ad group/ad/criterion batches use `partialFailure: true`. Budget and campaign creation are atomic steps — failure rolls launch to `FAILED` or `PARTIAL_SUCCESS` with recovery metadata.

## No silent mutations

- Draft generation: zero API calls
- Mutation plan build: zero API calls
- Validation: validate-only
- Execution: only after all approvals + explicit `execute-launch` action
