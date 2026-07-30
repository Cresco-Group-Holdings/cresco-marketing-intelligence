# Pipeline Health

## Deterministic signals

| Signal | Severity | Trigger |
|--------|----------|---------|
| no_next_action | WARNING | `nextAction` empty |
| overdue_task | WARNING | Active overdue tasks |
| stale_opportunity | WARNING | No activity > 14 days |
| close_date_passed | CRITICAL | Expected close date in past |
| missing_decision_maker | INFO | No DECISION_MAKER contact role |
| missing_value | WARNING | Expected value not set |
| stage_duration_exceeded | WARNING | Days in stage > maxDurationDays |
| repeated_stage_reversal | INFO | Multiple backward movements |
| no_recent_activity | INFO | No activity > 30 days |

## API

`GET /api/brands/[brandId]/crm/pipelines?view=health&pipelineId=...`

Returns `{ signals: HealthSignal[], summary: Record<string, number> }`

Permission: `forecast.read`

## UI

`/crm/pipeline-health` — lists all active signals across open opportunities.

## Design principles

- All signals are rule-based and explainable
- No ML confidence scores
- Signals inform action; they do not auto-close opportunities
