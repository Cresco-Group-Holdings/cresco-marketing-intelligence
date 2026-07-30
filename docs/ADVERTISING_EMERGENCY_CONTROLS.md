# Advertising Emergency Controls

Emergency controls block budget mutations and provider changes until explicitly restored with approval.

## Control Types

| Type | Effect |
|------|--------|
| `EMERGENCY_PAUSE` | Blocks all budget mutations |
| `PROVIDER_MUTATION_SHUTDOWN` | Blocks provider-side budget/campaign mutations |
| `ORGANISATION_FREEZE` | Organisation-wide advertising freeze |
| `ACCOUNT_FREEZE` | Account-scoped freeze |

## Behaviour

When any emergency control is active:

- `canMutateBudget()` returns `allowed: false` with blocker messages.
- Change request approvals are rejected until controls are resolved.
- Spend increases are never applied autonomously regardless of control state.

## Triggering

Use `triggerEmergency` API action with:

- `incidentType` — one of the control types above
- `reason` — required audit log reason
- Optional `provider`, `scopeType`, `scopeId` for scoped freezes

Incidents are persisted as `AdvertisingSpendIncident` records with `status: ACTIVE`.

## Restoration

Restoration requires explicit approval when incidents are active:

```
validateRestoration(state, restorationApproved)
```

- `restorationApproved: false` → restoration blocked
- `restorationApproved: true` → incident resolved, controls lifted

Resolved incidents record `resolvedByUserId` and `resolvedAt`.

## UI

Manage incidents at `/advertising/budgets/incidents`:

- View active incidents and reasons
- Trigger emergency pause
- Resolve with restoration approval

## Permissions

Emergency controls require `advertisingBudgets.emergency` (OWNER and ADMIN roles).
