# Ad Provider Mutation Plans

Immutable, hash-bound mutation plans for controlled ad campaign launches.

## Structure

Each mutation plan includes:

| Field | Description |
|---|---|
| `planHash` | SHA-256 of canonicalised operations |
| `operations` | Ordered create/update operations |
| `accountSnapshot` | Account state at plan creation |
| `budgetSummary` | Approved budget details |
| `targetingSummary` | Normalised targeting |
| `creativeSummary` | Creative payload summary |
| `trackingSummary` | Pixel/tag configuration |
| `optimisationSummary` | Objective and optimisation goal |
| `destinationSummary` | Landing page / form destination |
| `providerWarnings` | Provider-specific warnings |
| `risks` | Identified launch risks |

## Provider hierarchies

### LinkedIn

```
CAMPAIGN_GROUP → CAMPAIGN → CREATIVE
```

### TikTok

```
CAMPAIGN → AD_GROUP → AD
```

## Approval binding

- 8 approval gates bound to exact `planHash`
- Material changes to budget, audience, destination, creative, schedule, or objective invalidate all approvals
- Stale approvals block launch execution

## Idempotency

- Launch `idempotencyKey` = SHA-256(`provider:planId:planHash:version`)
- Duplicate execute returns existing resources when `status: CREATED`
- Provider resource `@@unique([launchId, internalRef])`

## Operation references

Internal refs use `resource:key` format (e.g. `campaign:primary`, `ad_group:primary`).
Cross-operation references use `{{internalRef}}` placeholders resolved at execution.

## Safety

- No operation added without passing capability gates
- Budget guardrails evaluated before material budget changes
- Account currency enforced at plan and launch time
