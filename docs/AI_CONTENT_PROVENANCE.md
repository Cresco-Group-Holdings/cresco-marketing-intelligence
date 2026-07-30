# AI Content Provenance — Long-Form Studio

Long-form content generation stores full AI provenance in `LongFormGenerationRun` records.

## Stored fields

| Field | Description |
|-------|-------------|
| `aiProvider` | AI provider used (e.g. OpenAI) |
| `aiModel` | Model identifier |
| `promptTemplateVersionId` | Prompt template version |
| `briefVersionId` | Source SEO brief version |
| `generatedSectionIds` | Sections produced in this run |
| `inputTokens` / `outputTokens` | Token usage |
| `estimatedCost` | Estimated cost in USD |
| `humanEditsAfter` | Human edits applied after generation |
| `sourceReferences` | Brand knowledge / evidence references |
| `action` | Generation action type |

## Generation actions

`OUTLINE`, `SECTION_GENERATE`, `SECTION_REGENERATE`, `SHORTEN`, `EXPAND`, `CHANGE_TONE`, `SIMPLIFY`, `ADD_EXAMPLES`, `REQUEST_EVIDENCE`, `FULL_DOCUMENT`

## Version history

`LongFormContentVersion` stores:

- Outline snapshot
- SEO assistance snapshot
- Compliance snapshot
- Human edit summary
- Change notes

## Principles

1. Every AI generation creates a `LongFormGenerationRun` record.
2. Human edits are tracked separately from AI output.
3. Brief version is pinned at document creation (`briefVersionId`).
4. No provenance record is created for manual section edits (version history captures those).
5. Export records include checksum for integrity verification.

## Audit trail

View generation history at `/content/long-form/[documentId]/history` or via:

```
GET /api/brands/[brandId]/content/long-form/[documentId]/history
```
