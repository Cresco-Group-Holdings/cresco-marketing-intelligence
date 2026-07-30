# Lead Capture Forms

Task 6.2 introduces a first-party form and lead-capture platform for Cresco websites, landing pages, and future customer workspaces.

## Architecture

```
LeadCaptureForm (publicFormId)
  └── LeadCaptureFormVersion (active)
        ├── LeadCaptureField (+ options)
        ├── LeadCaptureFormStep (multi-step)
        └── LeadCaptureConsentBlock
  └── LeadCaptureSubmission → CrmLead
        ├── LeadCaptureSubmissionValue
        ├── LeadCaptureSubmissionConsent
        └── LeadCaptureSpamAssessment
```

## Form lifecycle

DRAFT → IN_REVIEW → APPROVED → ACTIVE → PAUSED → ARCHIVED

Publishing requires at least one field on the active version.

## CRM integration

Valid submissions create `CrmLead` records via `crmService.createLead()` with:
- `sourceType`: mapped from form type (e.g. `GRANT_INTEREST`, `WEBSITE_FORM`)
- `CrmLeadSource`: form name, landing page, UTM parameters
- `CrmActivityTimelineItem`: `FORM_SUBMISSION` event

Quarantined submissions are stored but do not create CRM leads.

## Tenant resolution

Public API resolves tenant exclusively via `publicFormId` — never trusts browser-supplied tenant IDs.

## Deferred

- Full visual form builder drag-and-drop
- Hosted form page renderer
- React embed component package
- FILE_UPLOAD field implementation
- CAPTCHA provider integration
