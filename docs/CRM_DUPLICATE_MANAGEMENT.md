# CRM Duplicate Management

## Evidence types

| Evidence | Confidence | Auto-merge |
|----------|------------|------------|
| exact_verified_email | HIGH | Yes (if sole evidence) |
| exact_normalised_phone | HIGH | Yes |
| same_authenticated_user_id | HIGH | Yes |
| same_external_provider_id | HIGH | Yes |
| company_domain_plus_exact_name | MEDIUM | No |
| manually_reported | varies | No |

## Candidate statuses

PENDING → CONFIRMED | NOT_DUPLICATE | MERGED | EXPIRED

## Merge workflow

1. `detectDuplicates` — build evidence, increment duplicate metric
2. `previewMerge` — field conflict preview, activity count, consent strategy
3. `executeMerge` — archive source lead, create `CrmMergeOperation`, mark candidate MERGED, audit log

## Consent on merge

`resolveConsentOnMerge` applies the most restrictive valid consent per channel until human review.

## Attribution preservation

Source records are archived, not deleted. `CrmLeadSource.originalSourceType` on the destination lead is never overwritten by merge logic.

## Rollback

`rollbackStrategy` stored on merge operation: manual review required; source archived not deleted.
