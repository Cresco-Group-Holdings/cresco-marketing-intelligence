# CRM Pipelines

Task 6.3 introduces configurable, versioned sales pipelines per brand.

## Pipeline types

| Type | Use case |
|------|----------|
| GRANTS_SUBSCRIPTION | Cresco Grants subscriptions |
| CAPITAL_TERMINAL | Capital Cresco Terminal |
| ENTERPRISE_SALES | Enterprise sales |
| PARTNERSHIPS | Cresco Group partnerships |
| MANAGED_MARKETING | Managed marketing services |
| CUSTOM | Customer-defined |

No global hard-coded pipeline — each brand can have multiple pipelines.

## Versioning

- `CrmPipelineVersion` tracks stage configuration history
- Active version used for new opportunities
- `createVersion` copies stages from previous version

## Stage configuration

Each `CrmPipelineStage` supports:
- Name, sort order, category (OPEN → LOST)
- Default probability
- Entry/exit criteria (JSON)
- Required fields
- Max duration days
- Automation eligibility
- Approval requirement
- Archived state

## API

`GET/POST /api/brands/[brandId]/crm/pipelines`

Actions: `createPipeline`, `createVersion`, `addStage`, `createLossReason`, `createOpportunity`, `moveStage`, `markWon`, `markLost`

Views: `pipelines`, `kanban`, `forecast`, `health`, `lossReasons`

## Lead conversion

Creating an opportunity from a lead:
- Sets lead status to `OPPORTUNITY_CREATED`
- Sets lifecycle to `OPPORTUNITY`
- Enforces one open opportunity per lead
