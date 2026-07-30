# CRM Permissions

| Permission | Description |
|------------|-------------|
| `crm.read` | View CRM dashboard, leads, contacts, companies |
| `crm.create` | Create leads, import CSV |
| `crm.edit` | Update status, link identity |
| `crm.archive` | Archive records |
| `crm.export` | Export tenant data |
| `crm.viewSensitiveContact` | View full contact method values |
| `crm.manageCustomFields` | Define custom field schema |
| `crm.manageDuplicates` | Run duplicate detection |
| `crm.mergeRecords` | Preview and execute merges |
| `crm.assignOwner` | Assign lead owner |
| `crm.viewRevenue` | View revenue linkage |
| `crm.manageConsent` | Manage consent records |

## Role matrix

| Permission | Owner | Admin | Marketer | Analyst | Viewer |
|------------|-------|-------|----------|---------|--------|
| read | ✓ | ✓ | ✓ | ✓ | ✓ |
| create | ✓ | ✓ | ✓ | — | — |
| edit | ✓ | ✓ | ✓ | — | — |
| archive | ✓ | ✓ | — | — | — |
| export | ✓ | ✓ | ✓ | ✓ | — |
| viewSensitiveContact | ✓ | ✓ | — | — | — |
| manageCustomFields | ✓ | ✓ | — | — | — |
| manageDuplicates | ✓ | ✓ | ✓ | — | — |
| mergeRecords | ✓ | ✓ | — | — | — |
| assignOwner | ✓ | ✓ | ✓ | — | — |
| viewRevenue | ✓ | ✓ | — | — | — |
| manageConsent | ✓ | ✓ | — | — | — |

Enforced via `withCrm*` handlers and `hasPermission` in `src/lib/tenancy/permissions.ts`.
