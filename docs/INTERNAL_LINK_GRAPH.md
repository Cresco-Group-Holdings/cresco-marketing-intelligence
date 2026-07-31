# Internal Link Graph

## Models

| Model | Role |
|-------|------|
| `InternalLinkGraph` | Tenant-scoped graph container tied to brand, site, crawl run |
| `InternalLinkNode` | One crawled/indexable page with computed metrics |
| `InternalLinkEdge` | Directed internal link with anchor metadata |
| `InternalLinkSnapshot` | Point-in-time metrics snapshot for trend comparison |
| `InternalLinkAnchor` | Aggregated anchor usage per source→target pair |
| `InternalLinkIssue` | Detected structural or quality problem |
| `InternalLinkRecommendation` | Suggested new link with evidence |
| `InternalLinkChangeProposal` | User workflow item for implementing a recommendation |

## Inputs

Graph builds consume:

1. **Crawler page inventory** (`SeoCrawlPage`) — URL, status, indexability, page type
2. **Internal links** — parsed from crawl HTML
3. **Canonical relationships** — canonical URL and conflicts
4. **Topic clusters** — `SeoTopicCluster` membership
5. **Keywords** — page-level keyword mapping
6. **Traffic & GSC** — sessions, impressions, clicks where available
7. **Content status** — published/draft/archived signals

## Metrics (deterministic)

| Metric | Definition |
|--------|------------|
| Incoming internal links | Count of edges targeting this node |
| Outgoing internal links | Count of edges from this node |
| Crawl depth | Shortest path from home/root pages via internal links |
| Orphan status | Zero incoming internal links (excluding home) |
| Weakly linked | 1–2 incoming links on indexable content pages |
| Link concentration | Share of outgoing links to top target |
| Anchor repetition | Max anchor usage count for same text site-wide |
| Broken link count | Outgoing edges marked broken |
| Topical connection count | Distinct cluster peers linked |

## Visualization

Large sites use **sampling** (`sampleGraphForVisualization`) — prioritising high-traffic, orphan, and high-degree nodes up to a configurable cap (default 200).

Views:

- **Graph view** — force-directed sample of nodes/edges
- **Page neighbour view** — incoming/outgoing for one page
- **Cluster view** — nodes grouped by topic cluster
- **Orphan list** — filter `isOrphan = true`
- **Crawl depth view** — depth histogram and deep pages

## Build lifecycle

1. Select completed `SeoCrawlRun`
2. `POST /api/brands/{brandId}/seo/internal-links` with `{ seoSiteId, crawlRunId }`
3. Service creates nodes/edges, computes metrics, detects issues, generates recommendations
4. Graph status → `READY` (or `FAILED` with error message)
