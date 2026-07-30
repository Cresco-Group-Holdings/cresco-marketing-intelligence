# CRM Architecture

Task 6.1 introduces a tenant-safe CRM layer that sits alongside — but does not replace — the existing marketing inbox (`MarketingLead`) and identity stack (`MarketingIdentity`).

## Separation of concerns

| Layer | Model(s) | Purpose |
|-------|----------|---------|
| Anonymous marketing identity | `MarketingIdentity` | Pre-identification web/social behaviour |
| Identified person | `CrmPerson` | Canonical human record within a tenant |
| Lead | `CrmLead` | Sales/marketing qualification object |
| Contact | `CrmContact` | Operational contact profile linked to person |
| Company | `CrmCompany` | Organisation account with domains and hierarchy |
| Opportunity | *(deferred Task 6.2)* | Pipeline object |
| Product user | `UserProfile` / `authUserId` | Authenticated application user |
| Subscriber/customer | Revenue mapping *(existing)* | Billing relationship |
| Consent | Contact method + marketing consent *(bridge deferred)* | Lawful processing evidence |

## Bridge strategy

- `CrmLead.marketingLeadId` optionally links a CRM lead to an inbox `MarketingLead` without duplicating attribution.
- `CrmPerson.marketingIdentityId` optionally links to first-party identity records.
- `CrmLeadSource.originalSourceType` is immutable; `latestSourceType` may advance.

## Services

- `crmService` — lead lifecycle, identity links, duplicates, merge, import, custom fields.
- API: `GET/POST /api/brands/[brandId]/crm` with action-based mutations.
- UI: `/crm/*` routes backed by `CrmView`.

## Tenant isolation

Every query is scoped by `organisationId` and `brandId` via `brandService.getById` before data access.

## Deferred to Task 6.2+

- Opportunity/pipeline automation
- Email campaign execution
- MarketingLead → CrmLead auto-promotion workers
- Saved view persistence UI
- Full consent record model integration
