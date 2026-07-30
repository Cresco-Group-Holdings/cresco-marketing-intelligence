# Email Campaigns

One-time email campaigns and newsletters with approval gates and immutable recipient snapshots.

## Models

- `EmailCampaign` / `EmailCampaignVersion` — versioned campaign lifecycle
- `CrmAudienceSegment` — approved CRM audience segments
- `EmailCampaignAudience` — audience breakdown with consent/suppression counts
- `EmailCampaignContent` — subject, body, CTA, compliance
- `EmailCampaignSchedule` — send now or scheduled
- `EmailCampaignApproval` — bound approvals with content/audience hashes
- `EmailCampaignReadinessCheck` — 14 pre-send validation checks
- `EmailCampaignRecipientSnapshot` — immutable recipient list at launch
- `EmailCampaignSendRun` — dispatch execution record
- `EmailCampaignMetricSnapshot` — analytics with limitations
- `EmailCampaignExperiment` — A/B test configuration

## Statuses

`DRAFT` → `BUILDING` → `READY_FOR_REVIEW` → `APPROVED` → `SCHEDULED`/`SENDING` → `SENT`/`PARTIALLY_SENT`/`FAILED`

## API

`GET/POST /api/brands/{brandId}/email/campaigns`

Key actions: `createCampaign`, `setAudience`, `setContent`, `runReadinessChecks`, `grantApproval`, `setSchedule`, `createSnapshot`, `launchCampaign`, `cancelCampaign`, `emergencyStop`

## UI

- `/email/campaigns` — list
- `/email/campaigns/new` — create
- `/email/campaigns/[id]` — overview
- `/email/campaigns/[id]/audience` — audience builder
- `/email/campaigns/[id]/content` — content editor
- `/email/campaigns/[id]/review` — approvals and schedule
- `/email/campaigns/[id]/analytics` — metrics

## Launch flow

1. Create campaign and set audience from approved segment
2. Configure content with verified sender and unsubscribe link
3. Run readiness checks
4. Obtain all five approvals (audience, content, compliance, schedule, final send)
5. Create recipient snapshot
6. Launch — queues via Task 6.5 email message pipeline
