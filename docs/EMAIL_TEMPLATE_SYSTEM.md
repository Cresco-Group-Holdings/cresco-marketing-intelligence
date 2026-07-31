# Email Template System

## Versioning

Templates use `EmailTemplate` + `EmailTemplateVersion`. Each edit creates a new version in `DRAFT` status.

## Approval workflow

1. Create template version (`DRAFT`)
2. Preview with test variables
3. Submit for approval (`PENDING_APPROVAL` — optional intermediate)
4. Approve (`APPROVED`) — requires `email.approveTemplates`
5. Approved version becomes `currentVersionId`

## Content requirements

- Subject, preheader, HTML, plain text
- Approved variables only (see variable list)
- Marketing categories require unsubscribe flag or compliance footer
- HTML sanitised: script tags, event handlers, and `javascript:` URLs removed

## Approved variables

`firstName`, `lastName`, `fullName`, `company`, `product`, `ownerName`, `meetingDate`, `trialEnd`, `opportunityStage`, and `crm.{field}` with explicit permission.

Missing variables render as empty string and are reported in preview.

## Test send

Use `queueMessage` with `isTest: true` and `email.sendTest` permission.
