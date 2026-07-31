# Email Campaign Approval

## Approval types

| Type | Scope |
|------|-------|
| AUDIENCE | Segment rules and recipient counts |
| CONTENT | Subject, body, CTA |
| COMPLIANCE | Unsubscribe link, legal footer |
| SCHEDULE | Send time and timezone |
| FINAL_SEND | Authorisation to dispatch |

## Binding

Each approval records:

- `contentHash` — SHA-256 of campaign content
- `audienceRuleHash` — SHA-256 of segment rules
- `recipientCountMin` / `recipientCountMax` — approved range (±5% tolerance)
- `scheduledAtBound` — approved send time

## Invalidation

Material changes invalidate related approvals:

- Content edits invalidate CONTENT and COMPLIANCE approvals
- Audience changes invalidate AUDIENCE approvals
- Schedule changes invalidate SCHEDULE and FINAL_SEND approvals

## Launch validation

`launchCampaign` verifies all five approvals are `APPROVED` and bindings match current campaign state. Stale approvals are rejected.

## Permissions

`emailCampaigns.approve` — grant approvals (typically ADMIN/OWNER)
