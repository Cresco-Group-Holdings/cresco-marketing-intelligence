# Ad Mutation Recovery

## Partial campaign creation

**Symptoms**: Launch reports partial success; some resources created in provider

**Actions**:
1. Check `Advertising*AdsOperation` records for status
2. Review mutation plan operations vs provider state
3. Use `detectProviderStateDrift()` to compare expected vs actual
4. Do **not** re-launch with same idempotency key if partial success recorded
5. Manual cleanup in provider UI for orphaned resources
6. Create new mutation plan for remaining operations

## Timeout after mutation

**Symptoms**: Provider API timeout; unknown state

**Actions**:
1. Query provider for created resources by internal ref
2. If resources exist: mark launch as partial success
3. If resources absent: safe to retry with same idempotency key
4. Log in audit trail

## Duplicate launch request

**Prevention**: Idempotency key `sha256(provider:planId:planHash:version)`

**If duplicate detected**:
1. Return existing launch result
2. Increment `duplicate_prevention_hits` metric
3. Do not create duplicate provider resources

## Stale approval

**Symptoms**: Launch blocked; approvals marked STALE

**Actions**:
1. Notify user that plan changed after approval
2. User must re-approve all 8 launch approval types
3. New plan hash computed automatically

## Changed creative/budget after approval

Same as stale approval — plan hash changes invalidate all approvals.

## Provider state drift

**Symptoms**: `UNEXPECTED_PROVIDER_BUDGET_CHANGE` alert

**Actions**:
1. Compare provider-reported budget vs platform record
2. Investigate external changes (manual edits in provider UI)
3. Create budget change request if adjustment needed
4. Do not auto-sync budget increases
