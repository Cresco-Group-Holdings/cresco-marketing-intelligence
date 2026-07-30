# SEO Content Roadmap

Roadmap statuses connect topic cluster content plans to Content Operations.

## Statuses

| Status | Description |
|--------|-------------|
| IDEA | Initial concept |
| RESEARCH | Gathering evidence and keywords |
| BRIEF_REQUIRED | Needs content brief |
| BRIEF_READY | Brief approved |
| DRAFTING | Content creation in progress |
| REVIEW | Editorial review |
| PUBLISH_READY | Approved for publication |
| PUBLISHED | Live content |
| REFRESH_REQUIRED | Needs update |
| ARCHIVED | No longer active |

## Valid transitions

Transitions are enforced by `ROADMAP_TRANSITIONS` in `src/lib/topics/constants.ts`. Invalid transitions throw an error.

Example: `IDEA → RESEARCH → BRIEF_REQUIRED → BRIEF_READY → DRAFTING → REVIEW → PUBLISH_READY → PUBLISHED`

## Content Operations link

When an item moves to `DRAFTING` via `POST /roadmap?action=link-content`:

1. A `ContentItem` is created in Stage 2 Content Operations
2. The roadmap item's `contentItemId` is set
3. Status updates to `DRAFTING`

## Roadmap item types

- `pillar` — `SeoPillarPage`
- `supporting` — `SeoSupportingPage`
- `gap_plan` — `SeoContentGapPlan`

## API

```
GET  /api/brands/[brandId]/seo/roadmap
PATCH /api/brands/[brandId]/seo/roadmap  { itemType, itemId, roadmapStatus }
POST /api/brands/[brandId]/seo/roadmap?action=link-content
```
