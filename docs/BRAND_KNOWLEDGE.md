# Brand Knowledge Base

Task 1.5 introduces a structured, editable, and exportable brand knowledge base that future AI agents can use to produce accurate, brand-specific marketing content.

No AI providers are connected in this task.

## Data model

Each knowledge entity is scoped by `organisationId`, `projectId`, and `brandId`. Collection entities also include `archivedAt` for soft deletion.

| Model | Purpose |
| --- | --- |
| `BrandAudience` | Audience segments with countries, industries, pain points, motivations, objections, buying triggers, and preferred channels |
| `BrandPersona` | Multiple personas per brand |
| `BrandOffer` | Products and services with features, benefits, pricing, CTA, and availability |
| `BrandMessage` | One messaging record per brand with elevator pitch, proof points, differentiators, objection responses, and prohibited claims |
| `BrandVoiceRule` | One voice guide per brand with tone, vocabulary, style, and approved/unacceptable examples |
| `BrandCompetitor` | Manually entered competitor profiles |
| `BrandAsset` | Asset metadata for logos, colours, fonts, screenshots, presentations, and video clips |
| `BrandReference` | External references such as style guides and documentation |
| `BrandComplianceRule` | Compliance constraints such as prohibited claims and required disclaimers |

The existing `Brand` and `BrandProfile` models remain the identity foundation.

## API

All routes require organisation context and `brandKnowledge.read` or `brandKnowledge.update` permissions.

Base path:

`/api/brands/[brandId]/knowledge`

| Route | Methods | Description |
| --- | --- | --- |
| `/` | GET | Full knowledge snapshot |
| `/readiness` | GET | Deterministic readiness score |
| `/summary` | GET | Human-readable summary |
| `/export` | GET | JSON export with version metadata |
| `/import` | POST | Validated JSON import |
| `/audiences` | GET, POST | List or create audiences |
| `/audiences/[audienceId]` | PUT, DELETE | Update or archive audience |
| `/personas` | GET, POST | List or create personas |
| `/personas/[personaId]` | PUT, DELETE | Update or archive persona |
| `/offers` | GET, POST | List or create offers |
| `/offers/[offerId]` | PUT, DELETE | Update or archive offer |
| `/messaging` | GET, PUT | Read or upsert messaging |
| `/voice` | GET, PUT | Read or upsert voice rules |
| `/competitors` | GET, POST | List or create competitors |
| `/competitors/[competitorId]` | PUT, DELETE | Update or archive competitor |
| `/assets` | GET, POST | List or create assets |
| `/assets/[assetId]` | PUT, DELETE | Update or archive asset |
| `/references` | GET, POST | List or create references |
| `/references/[referenceId]` | PUT, DELETE | Update or archive reference |
| `/compliance-rules` | GET, POST | List or create compliance rules |
| `/compliance-rules/[ruleId]` | PUT, DELETE | Update or archive compliance rule |

## Readiness scoring

Readiness is deterministic and non-AI. Categories:

- identity
- audience
- offer
- messaging
- voice
- compliance
- assets

Each category reports:

- percentage score
- filled/total field counts
- missing fields
- recommended next fields

Archived records are excluded from readiness calculations.

## Import and export

Exports include:

- `version`
- `exportedAt`
- brand identity fields
- profile and knowledge entities without ownership metadata

Imports:

- validate against Zod schemas
- ignore `id`, `organisationId`, `projectId`, `brandId`, `createdAt`, `updatedAt`, and `archivedAt`
- always create records in the current tenant and brand context

## UI

Dashboard route:

`/brands/[brandId]/knowledge`

The page provides section tabs for readiness, audiences, personas, offers, messaging, voice, competitors, assets, compliance, and import/export.

## Deferred work

- ~~File storage for brand assets (Task 1.6)~~ — see `docs/BRAND_ASSETS.md`
- AI provider integration (later tasks)
- Competitor site scraping (later tasks)
