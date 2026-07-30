# On-Page SEO Optimisation

Task 4.7 — Analyse live or draft pages against technical, semantic, and content requirements with evidence-based recommendations. **Does not automatically modify production pages.**

## Routes

| Route | Purpose |
|-------|---------|
| `/seo/on-page` | Audit list and create |
| `/seo/on-page/[pageId]` | Audit detail, findings, recommendations |
| `/seo/on-page/[pageId]/history` | Version history |
| `/seo/on-page/[pageId]/compare` | Before/after comparison |

## Models

- `OnPageSeoAudit` — root audit record
- `OnPageSeoAuditVersion` — versioned audit runs
- `OnPageSeoFinding` — individual findings with required evidence
- `OnPageSeoRecommendation` — prioritised recommendations
- `OnPageSeoTarget` — target keyword/group/cluster
- `OnPageSeoComparison` — before/after comparisons
- `OnPageSeoOverride` — manual overrides

## Audit inputs

- Crawled page snapshot (`SeoPageSnapshot`)
- Long-form draft (`LongFormContentDocument`)
- SEO brief (`SeoContentBrief`)
- Target keyword, keyword group, topic cluster
- Search Console performance (via evidence bundle)
- Internal-link graph, structured data, competitor evidence

## Workflow

1. Create audit from crawl page, draft, or URL
2. Run audit (deterministic checks + optional AI semantic review)
3. Review findings and recommendations
4. Override or accept/dismiss recommendations
5. Compare versions (no ranking guarantees)

## Permissions

- `seoOnPage.read` — view audits
- `seoOnPage.manage` — create audits
- `seoOnPage.audit` — run audits
- `seoOnPage.override` — manual overrides

## Related docs

- [ON_PAGE_SEO_RULES.md](./ON_PAGE_SEO_RULES.md)
- [ON_PAGE_SEO_AI_REVIEW.md](./ON_PAGE_SEO_AI_REVIEW.md)
- [ON_PAGE_SEO_LIMITATIONS.md](./ON_PAGE_SEO_LIMITATIONS.md)
