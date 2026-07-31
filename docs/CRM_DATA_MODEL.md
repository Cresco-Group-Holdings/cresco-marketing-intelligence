# CRM Data Model

## Core entities

### CrmPerson
Canonical identified individual. Holds `displayName`, locale fields, optional `authUserId` and `marketingIdentityId`.

### CrmContact
1:1 extension of `CrmPerson` with job title, department, notes.

### CrmCompany
Legal/trading name, website, industry, size bands, enrichment metadata (provider, date, confidence — never fabricated).

### CrmLead
Operational lead with separate `status` (operational) and `lifecycleStage` (funnel position).

Required fields per spec: `organisationId`, `projectId`, `brandId`, `status`, `lifecycleStage`, `createdByUserId`, timestamps.

### CrmLeadSource
Attribution record. `originalSourceType` preserved; UTM, campaign, landing page, journey ID, evidence JSON.

### History tables
- `CrmLeadStatusHistory` — previous/new status, actor, reason, source, timestamp
- `CrmLeadLifecycleHistory` — previous/new stage, actor, reason, source, timestamp

### CrmContactMethod
Typed contact channels with normalised/display values, verification state, primary flag, consent eligibility.

### Identity & deduplication
- `CrmIdentityLink` — deterministic external IDs
- `CrmDuplicateCandidate` — review queue
- `CrmMergeOperation` — audited merge with conflict preview

### Custom fields
- `CrmCustomFieldDefinition` — tenant-defined schema
- `CrmCustomFieldValue` — typed value storage

### Activity
`CrmActivityTimelineItem` — unified timeline with `itemType`, `sourceSystem`, visibility.

### Import/export jobs
`CrmImportJob`, `CrmExportJob` — audit trail for bulk operations.

### Saved views
`CrmSavedView` — filter persistence (private/team).

## Enums

**Status:** NEW, OPEN, CONTACTED, RESPONDED, QUALIFYING, QUALIFIED, UNQUALIFIED, NURTURING, OPPORTUNITY_CREATED, CUSTOMER, LOST, SUPPRESSED, ARCHIVED

**Lifecycle:** VISITOR, LEAD, MARKETING_QUALIFIED, SALES_QUALIFIED, OPPORTUNITY, TRIAL, CUSTOMER, ACTIVE_CUSTOMER, FORMER_CUSTOMER, PARTNER

**Source types:** WEBSITE_FORM, WEBSITE_EVENT, SOCIAL_INBOX, SOCIAL_LEAD_FORM, ADVERTISING_LEAD_FORM, MANUAL_ENTRY, CSV_IMPORT, API, REFERRAL, EVENT, EMAIL_REPLY, CHAT, PARTNER, PRODUCT_SIGNUP, DEMO_REQUEST, GRANT_INTEREST, CAPITAL_ANALYSIS_INTEREST, OTHER
