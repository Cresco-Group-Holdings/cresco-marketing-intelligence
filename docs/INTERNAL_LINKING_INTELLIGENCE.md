# Internal Linking Intelligence

Task 4.8 delivers a tenant-safe internal-link graph and recommendation engine for improving discoverability, topic relationships, and navigation.

## Capabilities

- **Graph construction** from crawler inventory, internal links, canonicals, topic clusters, keywords, page type, indexability, traffic, Search Console data, and content status.
- **Deterministic metrics** per page: incoming/outgoing links, crawl depth, orphan status, weak linkage, link concentration, anchor repetition, broken links, topical connections.
- **Issue detection** for orphans, near-orphans, broken links, redirect/noindex targets, excessive depth, anchor repetition, disconnected clusters, low-support important pages, obsolete links, canonical conflicts.
- **Evidence-based recommendations** with source/target pages, anchor concepts (not forced exact-match), confidence, evidence, and conflict flags.
- **Change proposals** for approve/reject/edit/assign/export/implement/verify — no automatic site modification.

## UI Routes

| Route | Purpose |
|-------|---------|
| `/seo/internal-links` | Overview, build graph, orphan list |
| `/seo/internal-links/graph` | Sampled graph visualization |
| `/seo/internal-links/issues` | Detected issues queue |
| `/seo/internal-links/recommendations` | Link recommendation queue |
| `/seo/internal-links/pages/[pageId]` | Page neighbour view and metrics |

## Permissions

- `internalLinks.read` — view graphs, issues, recommendations
- `internalLinks.manage` — manage graph lifecycle
- `internalLinks.build` — trigger graph builds from crawl data
- `internalLinks.propose` — approve/reject/export change proposals

## Related docs

- [INTERNAL_LINK_GRAPH.md](./INTERNAL_LINK_GRAPH.md) — graph model and metrics
- [INTERNAL_LINK_RULES.md](./INTERNAL_LINK_RULES.md) — issue detection rules
- [INTERNAL_LINK_RECOMMENDATIONS.md](./INTERNAL_LINK_RECOMMENDATIONS.md) — recommendation logic
