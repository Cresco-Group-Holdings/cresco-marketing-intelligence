# CRM Personal Data Controls

## Classification

| Data | Sensitivity | Control |
|------|-------------|---------|
| Email, phone | High | `crm.viewSensitiveContact` |
| Name, company | Standard | `crm.read` |
| Attribution/UTM | Standard | `crm.read` |
| Revenue links | High | `crm.viewRevenue` |

## Storage

- Contact methods store `normalisedValue` and `displayValue` separately.
- Verification state tracked per method (`UNVERIFIED`, `PENDING`, `VERIFIED`, `INVALID`).
- `consentEligible` flag on contact methods for future consent integration.

## Export minimisation

`minimiseExportRow` excludes fields not in the user's visible field set.

Suppressed leads (`status: SUPPRESSED`) should be excluded from exports (enforcement in export service — deferred full implementation).

## Deletion & retention

CRM records support `archivedAt` soft archive. Hard deletion follows existing tenant data-retention architecture (not duplicated in Task 6.1).

Merge archives source leads; does not silently delete attribution or consent evidence.

## Tenant isolation

All CRM tables include `organisationId`. Brand-scoped operations require `brandId` match via `brandService.getById`.

Cross-tenant access is rejected at service and API layers.

## Audit

Merge operations emit `crm.merge.completed` audit events.

Import jobs record operator, mapping, and rejected row details.
