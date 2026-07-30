# Long-Form Export

Export formats for publish-ready long-form drafts. **No automatic publishing.**

## Formats

| Format | Description |
|--------|-------------|
| `HTML` | Full HTML document with headings, sections, references |
| `MARKDOWN` | Markdown with heading hierarchy |
| `JSON` | Structured document payload |
| `CMS_PAYLOAD` | Generic CMS adapter payload (extension point) |
| `COPY` | Plain text / markdown for clipboard |
| `HANDOFF` | Combined handoff package (JSON + HTML + Markdown + CMS) |

## Requirements

- Document must be `APPROVED` or `PUBLISH_READY`
- Requires `longForm.export` permission
- Each export creates a `LongFormExport` record with checksum

## API

```
POST /api/brands/[brandId]/content/long-form/[documentId]/export
Body: { "format": "HTML" | "MARKDOWN" | "JSON" | "CMS_PAYLOAD" | "COPY" | "HANDOFF" }
```

## CMS adapter extension points

The `CMS_PAYLOAD` format uses a generic adapter schema:

```json
{
  "adapter": "generic",
  "version": "1.0",
  "document": { "title", "slug", "blocks", "citations" },
  "publishReady": false,
  "note": "CMS adapter extension point — manual publish required."
}
```

Future CMS providers can implement adapter transforms without changing the core export service.

## Implementation

- `src/lib/long-form/export.ts` — format converters
- `src/server/services/long-form-export-service.ts` — export orchestration

## Security

- Tenant-scoped: exports only for documents in the requesting organisation/brand
- No publish API — export is read-only handoff
- Checksum (`sha256`) stored for audit integrity
