# Keyword Opportunity Rules

## Deterministic Opportunities

| Rule | Threshold | Severity |
|------|-----------|----------|
| HIGH_IMPRESSIONS_LOW_CTR | ≥50 impressions, CTR <2% | MEDIUM |
| POSITION_4_TO_20 | Position 4–20 | MEDIUM |
| INCREASING_IMPRESSIONS | >20% growth | LOW |
| DECLINING_POSITION | >2 position drop | HIGH |
| NO_TARGET_PAGE | No PRIMARY/SECONDARY mapping | MEDIUM |
| WEAK_TARGET_PAGE | Mapped but under-optimised | MEDIUM |
| BRANDED_NO_RESULT | Branded query, no suitable page | HIGH |
| INCOMPLETE_CLUSTER | <50% cluster coverage | LOW |

## Evidence Requirements

Every opportunity includes:
- `opportunityType`, `severity`, `title`, `explanation`
- JSON `evidence` with metric values used
- `recommendedAction`

## Cannibalisation States

POSSIBLE → LIKELY → CONFIRMED (never auto-confirmed without adequate evidence)

Dismissed via status update (extension point).

## Evaluation

Run via `POST /api/brands/[brandId]/seo/keywords/opportunities?action=evaluate`
