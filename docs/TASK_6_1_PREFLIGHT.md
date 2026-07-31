# Task 6.1 Pre-Flight Audit

Audit conducted before implementing the CRM and Lead Data Foundation.

## Reusable models (do not duplicate)

| Existing model | Reuse strategy |
|----------------|----------------|
| `MarketingLead` | Remains marketing inbox; `CrmLead.marketingLeadId` optional bridge |
| `MarketingIdentity` | Link via `CrmIdentityLink` type `MARKETING_IDENTITY` |
| `LeadSource`, `LeadActivity`, etc. | Marketing-specific; parallel `CrmLeadSource` for CRM |
| `RevenueCustomer` | Link via `CrmIdentityLink` type `STRIPE_CUSTOMER` |
| `AttributionJourney` | Reference on `CrmLeadSource.attributionJourneyId` |
| `CrmHandoff` | Outbound export only — not internal CRM |
| `UserProfile` | Auth user link via `CrmPerson.authUserId` |

## Naming conflicts

| Name | Resolution |
|------|------------|
| `CrmHandoff` / `CrmProvider` | Reserved for outbound integrations |
| `MarketingLead` vs `CrmLead` | Separate models; bridge field only |
| `LeadSource` vs `CrmLeadSource` | Separate models per domain |

## Proposed migration

`20260730390000_task_6_1_crm_lead_data_foundation` — additive only; no MarketingLead data migration in 6.1.

## Tenant-context risks

- All CRM queries scoped by `organisationId` + `brandId`
- Sensitive contact methods require `crm.viewSensitiveContact`
- Export respects field permissions

## Identity-resolution risks

- No merge on similar names, location, device fingerprint, or AI confidence
- Deterministic links only: verified email, phone, auth user, external IDs, staff confirmation

## Personal-data exposure risks

- Contact methods permission-gated
- Export minimisation via field visibility
- CSV injection protection on import/export

## Existing lead sources

- Social: manual API (`POST /leads`) — not auto-wired to CRM
- Website: `form_submit` events — no lead bridge yet
- Advertising: lead forms — planning only
- Manual entry, CSV (marketing export only)

## Deferred capabilities

- Pipeline/opportunity automation (Task 6.2+)
- Email campaigns
- MarketingLead → CrmLead bulk migration job
- Website/social auto-capture bridge
- Company enrichment APIs
- Retention scheduler for CRM records
