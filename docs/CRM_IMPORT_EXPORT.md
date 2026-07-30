# CRM Import and Export

## CSV import

Supported entities: leads, contacts, companies (leads implemented in Task 6.1).

### Requirements

- Field mapping with required email for leads
- Row sanitisation via `sanitizeCsvCell` (CSV injection protection)
- Per-row validation with rejected row details
- `CrmImportJob` audit record (total/accepted/rejected rows, mapping, timestamps)
- Source declared as `CSV_IMPORT` on created leads

### API

```json
{ "action": "importLeads", "rows": [...], "mapping": { "email": "email", "name": "name" } }
```

## Export

`CrmExportJob` records exporter, entity type, format, row count, filters.

Export minimisation via `minimiseExportRow` — only permission-visible fields included.

### Permissions

- Import: `crm.create`
- Export: `crm.export`

Sensitive contact values require `crm.viewSensitiveContact`.

## Idempotency

`buildIdempotencyKey(organisationId, fileName, rowHash)` available for future worker deduplication.

## Deferred

- Async import worker
- Company/contact CSV templates
- Export download endpoints
