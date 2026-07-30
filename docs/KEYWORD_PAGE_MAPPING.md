# Keyword Page Mapping

## Relationship Types

| Type | Description |
|------|-------------|
| PRIMARY_TARGET | Intended primary ranking page |
| SECONDARY_TARGET | Supporting page |
| CURRENTLY_RANKING | Page currently ranking (observed) |
| POTENTIAL_TARGET | Candidate page |
| CONFLICTING_TARGET | Competing page |
| NOT_RELEVANT | Explicitly not relevant |

## Rules

- Do not infer PRIMARY_TARGET from a single ranking observation
- Manual mappings have `isManual: true` and `confidence: 1`
- GSC/CSV imports create CURRENTLY_RANKING mappings with evidence
- Mappings reference `SeoCrawlPage` when available, or `intendedUrl`

## Cannibalisation Link

Multiple CURRENTLY_RANKING or PRIMARY_TARGET mappings for the same keyword trigger cannibalisation detection (POSSIBLE → LIKELY → CONFIRMED).
