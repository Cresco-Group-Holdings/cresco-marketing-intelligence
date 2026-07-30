# Topic Cluster Engine

Task 4.4 organises keywords, pages, entities, and competitor gaps into structured topic clusters.

## Models

| Model | Purpose |
|-------|---------|
| `SeoTopic` | High-level topic theme |
| `SeoTopicCluster` | Keyword/page cluster with confidence and evidence |
| `SeoTopicClusterMember` | Member link (keyword, page, entity, gap) with lock flag |
| `SeoTopicEntity` | Entity within cluster context |
| `SeoPillarPage` | Pillar content assignment |
| `SeoSupportingPage` | Supporting content linked to pillar |
| `SeoContentGapPlan` | Gap remediation plan |
| `SeoContentStrategy` | Strategy container |
| `SeoContentStrategyVersion` | Versioned strategy snapshot |
| `SeoContentPriorityScore` | Versioned priority score |

## Cluster inputs

- Keywords with intent and entities
- Existing crawl pages and page mappings
- Search Console metrics (impressions, position)
- Competitor content gaps (Task 4.3)
- Brand Knowledge context (for AI proposals)

## Clustering rules

1. **Locked members** — `isLocked: true` members are never moved by automatic clustering
2. **Entity grouping** — keywords sharing confirmed entities cluster together
3. **Intent + semantic** — same intent plus ≥50% token overlap extends groups
4. **Competitor gaps** — matched gaps attached as `COMPETITOR_GAP` members
5. **AI naming** — optional AI cluster naming requires user confirmation

## API

| Method | Path | Action |
|--------|------|--------|
| GET/POST | `/seo/topics` | List/create topics |
| GET/POST | `/seo/clusters` | List/create clusters |
| POST | `/seo/clusters?action=cluster` | Run clustering |
| GET/PATCH/POST | `/seo/clusters/[id]` | Detail, update, score |
| POST | `/seo/clusters/[id]/members` | Add locked member |
| POST | `/seo/clusters/[id]/ai` | AI strategy proposal |
| GET/POST | `/seo/strategy` | Strategy management |
| GET/PATCH/POST | `/seo/roadmap` | Roadmap items |

## Permissions

- `seoTopics.read` — view clusters and strategy
- `seoTopics.manage` — create topics, pillars, roadmap transitions
- `seoTopics.cluster` — run clustering engine
- `seoTopics.strategy` — create strategies and AI proposals
