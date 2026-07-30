# SEO Brief Generator

Task 4.5 generates structured, evidence-grounded SEO content briefs. **It does not generate the complete article.**

## Models

| Model | Purpose |
|-------|---------|
| `SeoContentBrief` | Brief container with status workflow |
| `SeoContentBriefVersion` | Versioned structured output with AI provenance |
| `SeoBriefKeyword` | Primary and secondary keywords |
| `SeoBriefQuestion` | Questions to answer and FAQ items |
| `SeoBriefHeading` | Heading hierarchy outline |
| `SeoBriefCompetitorEvidence` | Truncated competitor structure evidence |
| `SeoBriefInternalLink` | Internal link suggestions (not auto-inserted) |
| `SeoBriefSchemaSuggestion` | Schema markup suggestions |
| `SeoBriefCitationRequirement` | External evidence needs |
| `SeoBriefApproval` | Approval workflow records |
| `SeoBriefComment` | Review comments |

## Status workflow

`DRAFT → GENERATED → IN_REVIEW → APPROVED | CHANGES_REQUESTED → SUPERSEDED → ARCHIVED`

## Inputs

- Primary/secondary keywords with intent
- Topic cluster membership
- Target crawl page
- Search Console metrics (when synced)
- Competitor page evidence (truncated)
- Brand Knowledge snapshot
- Audience, offer, CTA

## API

| Method | Path | Action |
|--------|------|--------|
| GET/POST | `/seo/briefs` | List/create |
| GET/PATCH/POST | `/seo/briefs/[id]` | Detail, update, actions |
| GET | `/seo/briefs/[id]/history` | Versions, approvals, comments |

### Actions (`POST ?action=`)
- `generate` — AI brief generation
- `submit-review` — Submit for approval
- `approve` — Approve or request changes
- `comment` — Add review comment

## Permissions

- `seoBriefs.read`, `seoBriefs.manage`, `seoBriefs.generate`, `seoBriefs.approve`

## UI

- `/seo/briefs` — list
- `/seo/briefs/new` — create draft
- `/seo/briefs/[briefId]` — detail and actions
- `/seo/briefs/[briefId]/history` — version history

See also: [SEO_BRIEF_SCHEMA.md](./SEO_BRIEF_SCHEMA.md), [SEO_BRIEF_EVIDENCE.md](./SEO_BRIEF_EVIDENCE.md), [SEO_BRIEF_APPROVAL.md](./SEO_BRIEF_APPROVAL.md).
