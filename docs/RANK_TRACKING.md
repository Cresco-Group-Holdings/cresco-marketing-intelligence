# Rank Tracking

Task 4.9 delivers search visibility tracking and content refresh intelligence using licensed or official data sources only.

## Capabilities

- **Rank tracking projects** with keyword quotas per plan
- **Tracked keywords** with target page, country, language, device, schedule, priority, tags
- **Rank observations** from Search Console, approved rank providers, manual import, or compliant SERP sources
- **Rank history** with current/previous/best/average position, visibility trend, URL changes, top-range entries
- **Volatility signals** for position movement, URL switching, impression/click decline, SERP feature changes
- **Content decay detection** using multi-signal evidence (not age alone)
- **Refresh recommendations** with evidence, confidence, hypothesis, and measurement plan
- **Workflow conversion** to SEO brief, content task, long-form revision, experiment, internal-link proposal, or technical fix

## UI Routes

| Route | Purpose |
|-------|---------|
| `/seo/rankings` | Project overview |
| `/seo/rankings/keywords` | Tracked keywords and positions |
| `/seo/rankings/pages` | Ranking URLs |
| `/seo/rankings/changes` | Rank changes and alerts |
| `/seo/content-refresh` | Refresh candidate queue |
| `/seo/content-refresh/[candidateId]` | Candidate detail and recommendations |

## Permissions

- `rankTracking.read` — view projects, keywords, history
- `rankTracking.manage` — create projects, add keywords, scan decay
- `rankTracking.import` — import observations
- `contentRefresh.read` — view refresh candidates
- `contentRefresh.manage` — convert recommendations to workflows

## Related docs

- [RANK_DATA_SOURCES.md](./RANK_DATA_SOURCES.md)
- [CONTENT_DECAY.md](./CONTENT_DECAY.md)
- [CONTENT_REFRESH_WORKFLOW.md](./CONTENT_REFRESH_WORKFLOW.md)
- [RANK_TRACKING_LIMITATIONS.md](./RANK_TRACKING_LIMITATIONS.md)
