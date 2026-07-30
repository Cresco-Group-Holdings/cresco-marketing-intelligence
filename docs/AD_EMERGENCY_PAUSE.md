# Ad Emergency Pause

## When to trigger

- Confirmed overspend beyond hard limit
- Tracking failure with active spend
- Suspected unauthorised mutation
- Provider account compromise
- Policy violation under investigation

## How to trigger

### Platform UI
1. Navigate to `/advertising/budgets/incidents`
2. Enter reason
3. Click "Emergency pause"

### API
```
POST /api/brands/{brandId}/advertising/budgets/{resourceId}
{ "action": "triggerEmergency", "incidentType": "EMERGENCY_PAUSE", "reason": "..." }
```

### Environment (organisation-wide)
```
ADVERTISING_EMERGENCY_SHUTDOWN=true
```

## What is blocked

- Budget mutations and change request approvals
- Provider launch execution
- Optimisation action approvals for material changes

## What is NOT blocked

- Read-only reporting and dashboards
- Viewing existing campaigns and plans
- Creating drafts (not launching)

## Provider-side pause

Platform emergency pause does **not** automatically pause campaigns in Google/Meta/LinkedIn/TikTok. Operators must manually pause in provider UI if immediate spend stop is required.

## Restoration

1. Investigate and resolve root cause
2. Navigate to `/advertising/budgets/incidents`
3. Click "Resolve with approval"
4. Or clear `ADVERTISING_EMERGENCY_SHUTDOWN` for env-level pause
5. Verify readiness check passes
6. Resume with heightened monitoring

## Audit trail

All emergency actions recorded via `recordAdvertisingAuditEvent`:
- `advertising.budget.emergency_pause`
- `advertising.budget.emergency_resolved`
