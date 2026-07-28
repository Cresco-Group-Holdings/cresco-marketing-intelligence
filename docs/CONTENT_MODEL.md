# Unified Social Content Model

Task 2.2 introduces the shared content lifecycle used by every social network.

## Models

| Model | Purpose |
|-------|---------|
| `ContentItem` | Campaign idea / core brief |
| `ContentVariant` | Platform-specific version |
| `ContentAsset` | Linked marketing assets |
| `ContentRevision` | Immutable revision history |
| `ContentApproval` | Approval workflow records |
| `ContentComment` | Review comments |
| `ContentProvenance` | AI/manual provenance and licences |
| `ContentComplianceCheck` | Deterministic compliance findings |
| `ContentStatusHistory` | Status transition audit trail |
| `OrganisationContentSettings` | Approval mode configuration |

## Status machine

Statuses are changed only through `contentService` workflow methods. Direct status updates are not permitted.

Supported statuses: `IDEA`, `DRAFT`, `AI_GENERATED`, `IN_REVIEW`, `CHANGES_REQUESTED`, `APPROVED`, `SCHEDULED`, `PUBLISHING`, `PUBLISHED`, `PARTIALLY_PUBLISHED`, `FAILED`, `CANCELLED`, `ARCHIVED`.

## Approval modes

- `NO_APPROVAL_REQUIRED` — submit moves directly to `APPROVED`
- `ONE_APPROVER` — implemented
- `TWO_APPROVERS` — extension point
- `COMPLIANCE_APPROVAL_REQUIRED` — extension point

Separation of duties prevents creators from approving their own content when enabled.

## API

Brand-scoped routes under `/api/brands/{brandId}/content`.

## UI

- `/content` — list (table, cards, workflow columns)
- `/content/new` — create
- `/content/[contentId]` — detail
- `/content/[contentId]/edit` — edit
- `/content/[contentId]/review` — approve / request changes / comment
- `/content/[contentId]/history` — revisions and restore

## Out of scope

- AI generation
- Social publishing
- Real-time collaboration
