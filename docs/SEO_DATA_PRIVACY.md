# SEO Data Privacy

## Data categories

| Category | Examples | Handling |
|----------|----------|----------|
| Form fields | Contact forms in crawled HTML | Not extracted or stored |
| URLs with PII | `/user/john@email.com` | Stored as URL only; no PII extraction |
| Query parameters | `?email=...` | Stripped during URL normalisation where tracking params |
| Raw HTML | Full page HTML | Stored in snapshots; access gated by `seoRawData.view` |
| User-generated content | Blog comments in pages | Stored as page content; not separately indexed |
| Authenticated pages | Login-required pages | Not supported in v1; extension point only |
| Exports | CSV, JSON exports | Organisation-scoped; formula injection sanitised |
| Logs | Crawl errors, SSRF blocks | No secrets, no full HTML in logs |
| AI prompts | User input + page excerpts | Redacted digest stored; no raw prompt retention |

## Retention

- Crawl snapshots: retained per site; purge via site archival
- Rank observations: retained for trend analysis; configurable per project
- Competitor evidence: public excerpts only; linked to collection date
- AI usage records: token counts and cost; input digest only

## Deletion

- Organisation archival cascades SEO data via Prisma `onDelete: Cascade`
- Individual site deletion removes crawl pages, issues, graphs
- User profile deletion restricted on created records (`onDelete: Restrict`)

## GDPR considerations

- Crawled websites may contain third-party PII — customers responsible for crawl scope
- Export endpoints require explicit permission
- No automated PII detection in v1 — recommend excluding `/account`, `/profile` paths via exclude rules

## Access controls

- All SEO data tenant-scoped by `organisationId` + `brandId`
- Raw HTML requires `seoRawData.view` permission (ADMIN/ANALYST)
- Worker routes use service token only; no user data exposed
