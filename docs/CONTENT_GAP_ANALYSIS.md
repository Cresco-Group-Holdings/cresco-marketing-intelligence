# Content Gap Analysis

Evidence-based content gap detection compares brand crawl data with competitor public page inventory and keyword overlaps.

## Gap types

| Type | Trigger |
|------|---------|
| `TOPIC_COVERAGE` | Competitor topic appears on crawled pages; brand has no matching topic |
| `MISSING_PAGE` | Competitor has a ranking URL for a keyword; brand has no mapped page |
| `WEAK_PAGE` | Both have pages for a keyword; brand word count < 50% of competitor |
| `MISSING_FORMAT` | Competitor uses a content format (blog, FAQ, glossary, etc.) not found on brand site |
| `MISSING_FUNNEL_STAGE` | Reserved for future funnel-stage rules |
| `MISSING_FAQ_GLOSSARY` | Reserved for FAQ/glossary-specific rules |

## Inputs

- Brand pages from latest `SeoPageSnapshot` per `SeoCrawlPage`
- Competitor pages from `SeoCompetitorPage`
- Competitor topics from `SeoCompetitorTopic`
- Keyword gaps from `SeoKeywordOverlap` (SHARED and COMPETITOR_UNIQUE)

## Output fields

Each gap includes:

- `title` and `explanation` — human-readable summary
- `evidence` — JSON with URLs, counts, and keyword references
- `recommendedAction` — strategic next step (not "copy competitor")
- `originalityGuidance` — explicit anti-copying guidance

## What gaps are NOT

- Not automatic content briefs
- Not recommendations to replicate competitor copy
- Not based on inferred search volume or traffic
- Not generated without underlying page or keyword evidence

## Workflow

1. Register competitor and run public crawl (or add keyword observations)
2. Ensure brand site has been crawled via technical SEO crawler
3. Calculate keyword overlaps (`POST /overlap?competitorId=...`)
4. Detect content gaps (`POST /content-gaps?competitorId=...`)
5. Review gaps at `/seo/competitors/content-gaps`
