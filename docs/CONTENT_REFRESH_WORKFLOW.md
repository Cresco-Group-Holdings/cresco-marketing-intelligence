# Content Refresh Workflow

## Recommendation types

| Type | Use case |
|------|----------|
| `UPDATE_FACTS` | Outdated factual information |
| `UPDATE_STATISTICS` | Stale data points |
| `EXPAND_SECTION` | Thin coverage vs competitors |
| `IMPROVE_TITLE` | Low CTR signal |
| `IMPROVE_DESCRIPTION` | Low CTR signal |
| `ADD_FAQ` | Featured snippet opportunity |
| `ADD_INTERNAL_LINKS` | Lost internal link support |
| `CONSOLIDATE_CONTENT` | Cannibalisation / thin pages |
| `FIX_TECHNICAL` | Crawl or on-page technical issues |
| `REWRITE_INTRODUCTION` | Stale content with engagement decline |
| `IMPROVE_CTA` | Traffic without conversion |
| `REVIEW_SEARCH_INTENT` | Ranking/CTR mismatch |
| `RETIRE_CONTENT` | Obsolete content with no recovery path |

## Every recommendation includes

- **Evidence** — JSON signal data
- **Date range** — baseline observation window
- **Confidence** — 0–1 score from signal strength
- **Expected hypothesis** — what improvement is expected
- **Measurement plan** — how to verify post-implementation

## Workflow conversion

Users convert approved recommendations into workflow items via `SeoContentRefreshOutcome`:

| Workflow | Enum | Destination |
|----------|------|-------------|
| SEO brief update | `SEO_BRIEF` | `SeoContentBrief` |
| Content task | `CONTENT_TASK` | Content item workflow |
| Long-form revision | `LONG_FORM_REVISION` | `LongFormContentDocument` |
| Experiment | `EXPERIMENT` | A/B test |
| Internal link proposal | `INTERNAL_LINK_PROPOSAL` | Internal link change proposal |
| Technical fix | `TECHNICAL_FIX` | Technical task |

**No automatic publishing** — all workflows require human review and implementation.

## Outcome tracking

| Status | Meaning |
|--------|---------|
| `CREATED` | Workflow item created |
| `IN_PROGRESS` | Work underway |
| `IMPLEMENTED` | Changes deployed |
| `MEASURED` | Post-implementation metrics collected |
| `CLOSED` | Refresh cycle complete |

## API

- `POST /api/brands/{brandId}/seo/content-refresh/{candidateId}` with `{ recommendationId, workflowType }`
