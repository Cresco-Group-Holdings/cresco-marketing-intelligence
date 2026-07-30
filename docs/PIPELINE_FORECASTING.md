# Pipeline Forecasting

## Deterministic metrics

| Metric | Calculation |
|--------|-------------|
| Total open value | Sum of EXPECTED values for OPEN opportunities |
| Weighted value | Σ (expectedValue × probability / 100) for OPEN |
| Expected close value | Open opportunities closing this calendar month |
| Won value | Sum of EXPECTED values for WON |
| Lost value | Sum of EXPECTED values for LOST |
| Stage conversion | Advanced / entered per stage category |
| Stage velocity | Average days in current stage |
| Average sales cycle | Created → won duration for WON opportunities |

## Disclaimer

Weighted pipeline value is explicitly labelled as a **deterministic estimate** (value × probability). It is not opaque predictive forecasting.

## API

`GET /api/brands/[brandId]/crm/pipelines?view=forecast&pipelineId=...`

Permission: `forecast.read`

## Extension points

- Multi-currency normalisation (deferred)
- Historical forecast snapshots (deferred)
- ML-based predictive forecasting (explicitly not implemented)
