# Long-Form SEO Content Studio

Task 4.6 — AI Long-Form SEO Content Studio generates and edits long-form SEO content from **approved SEO briefs** with brand, evidence, compliance, and provenance controls.

## Overview

Workflow:

```
Approved SEO Brief → outline confirmation → section generation → evidence review
→ SEO review → compliance review → human approval → publish-ready export
```

**No content publishes automatically.**

## Routes

| Route | Purpose |
|-------|---------|
| `/content/long-form` | Document list |
| `/content/long-form/new` | Create from approved brief |
| `/content/long-form/[documentId]` | Editor |
| `/content/long-form/[documentId]/history` | Version & generation history |
| `/content/long-form/[documentId]/review` | SEO & compliance review |

## Models

- `LongFormContentDocument` — root document linked to approved `SeoContentBrief`
- `LongFormContentVersion` — version snapshots with outline, SEO, compliance
- `LongFormSection` — section blocks with locked text support
- `LongFormCitation` — citations (fabrication detection)
- `LongFormClaim` — classified factual claims
- `LongFormGenerationRun` — AI provenance per generation action
- `LongFormReview` — workflow review stages
- `LongFormExport` — export records (HTML, Markdown, JSON, CMS, copy, handoff)

## Content types

`BLOG_ARTICLE`, `GUIDE`, `LANDING_PAGE`, `COMPARISON`, `CASE_STUDY`, `FAQ`, `GLOSSARY`, `DOCUMENTATION`, `PILLAR_PAGE`, `SUPPORTING_ARTICLE`

## Section operations

- Regenerate section (never full document unless `FULL_DOCUMENT` requested)
- Shorten, expand, change tone, simplify, add examples, request evidence
- Preserve locked text via `lockedRanges` and `isLocked`

## Permissions

- `longForm.read` — view documents
- `longForm.manage` — create, edit, workflow submit
- `longForm.generate` — AI outline/section generation
- `longForm.review` — approve/reject review stages
- `longForm.export` — export publish-ready drafts

## API

Base: `/api/brands/[brandId]/content/long-form`

Actions on document: `generate-outline`, `confirm-outline`, `generate-sections`, `submit-review`, `review-decide`, `seo-assistance`

Section actions: `SECTION_REGENERATE`, `SHORTEN`, `EXPAND`, `CHANGE_TONE`, `SIMPLIFY`, `ADD_EXAMPLES`, `REQUEST_EVIDENCE`

## Related docs

- [AI_CONTENT_PROVENANCE.md](./AI_CONTENT_PROVENANCE.md)
- [CONTENT_CLAIM_REVIEW.md](./CONTENT_CLAIM_REVIEW.md)
- [LONG_FORM_EXPORT.md](./LONG_FORM_EXPORT.md)
