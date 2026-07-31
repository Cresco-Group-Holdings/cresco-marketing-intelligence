# Lead Scoring Simulation

What-if analysis for scoring model changes before activating a new version in production.

## Purpose

Simulations answer:

- How many leads would change qualification status?
- What is the new score distribution?
- Which rules contribute the most points across the cohort?

Simulations do not write scores to production. Results are stored in `LeadScoringSimulation` for review and approval.

## Workflow

```
DRAFT model version
       │
       ▼
Select lead cohort (parameters)
       │
       ▼
Run simulation (RUNNING → COMPLETED)
       │
       ▼
Review results (distribution, status changes, high-impact rules)
       │
       ▼
Approve or reject (APPROVED / REJECTED)
       │
       ▼
Activate approved version (ACTIVE)
```

## Input

`simulateModel(model, leads)` accepts:

| Field | Type | Description |
|-------|------|-------------|
| `snapshot` | `LeadSnapshot` | Current CRM field values for the lead |
| `previousStatus` | `QualificationStatus` | Status before simulation (default `UNASSESSED`) |
| `previousCompositeScore` | `number` | Score before simulation (default 0) |

The model under test includes rule groups, caps, and optional decay configuration identical to production scoring.

## Output

| Field | Description |
|-------|-------------|
| `totalLeads` | Cohort size |
| `affectedLeadCount` | Leads with score or status change |
| `unaffectedLeadCount` | Leads with identical score and status |
| `statusChanges` | Per-lead previous/new status and scores |
| `scoreDistribution` | Counts in buckets: 0–24, 25–49, 50–74, 75–100 |
| `highImpactRules` | Top 10 rules by total points contributed |
| `averageCompositeScore` | Mean composite across cohort |
| `medianCompositeScore` | Median composite across cohort |

### Status change record

```json
{
  "leadId": "lead-abc",
  "previousStatus": "WARM",
  "newStatus": "HOT",
  "previousScore": 30,
  "newScore": 55
}
```

### High-impact rule record

```json
{
  "ruleId": "eng-demo",
  "signal": "DEMO_REQUESTED",
  "label": "Demo requested",
  "matchCount": 42,
  "totalPointsContributed": 1050,
  "affectedLeadIds": ["lead-1", "lead-2"]
}
```

## Score distribution buckets

| Range | Typical qualification |
|-------|----------------------|
| 0–24 | COLD |
| 25–49 | WARM |
| 50–74 | HOT |
| 75–100 | QUALIFIED |

Distribution helps identify whether a model change shifts the cohort toward or away from sales-ready thresholds.

## Permissions

| Action | Permission |
|--------|------------|
| Run simulation | `leadScoring.simulate` |
| Approve simulation results | `leadScoring.approve` |
| Activate model after approval | `leadScoring.activate` |

Marketers can simulate but cannot approve. Analysts can simulate and view results.

## Best practices

1. **Use representative cohorts** — include leads across fit levels, engagement states, and negative signals
2. **Compare against active version** — set `previousStatus` and `previousCompositeScore` from current snapshots
3. **Review high-impact rules** — rules with disproportionate contribution may indicate cap misconfiguration
4. **Check status change volume** — large shifts may require sales team communication before activation
5. **Run after safety review** — confirm `validateModelSafety` passes before simulating

## AI rule improvements

`proposeRuleImprovements` surfaces non-destructive suggestions from a single lead score (unmatched groups, zero-point rules, caps reached, missing data). These complement cohort simulation for model tuning.

All AI outputs are grounded (`grounded: true`) and blocked from auto-apply (`modifiesScore: false`).

## Related documentation

- [LEAD_SCORING.md](./LEAD_SCORING.md) — scoring engine overview
- [LEAD_SCORING_SAFETY.md](./LEAD_SCORING_SAFETY.md) — safety checklist before simulation
- [LEAD_QUALIFICATION.md](./LEAD_QUALIFICATION.md) — qualification threshold definitions
