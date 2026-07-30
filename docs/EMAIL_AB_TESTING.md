# Email A/B Testing

## Supported variants

- Subject
- Preheader
- Sender name
- Content
- CTA

## Configuration

`EmailCampaignExperiment` fields:

- `sampleAllocationPercent` — percentage receiving variant A (default 50%)
- `primaryMetric` — `open_rate`, `click_rate`, or `conversion_rate`
- `minimumSample` — minimum recipients per variant (default 100)
- `decisionRule` — optional custom rule description
- `testDurationHours` — optional test window

## Allocation

Recipients in the snapshot are assigned variant A or B deterministically by index at snapshot creation time.

## Winner selection

`evaluateExperiment` requires:

1. Both variants reach `minimumSample`
2. Metric difference exceeds 2% significance threshold

If insufficient evidence, status is `INSUFFICIENT_EVIDENCE` and no winner is selected automatically.

## Validity warnings

Warnings are stored on the experiment record when:

- Sample size is below minimum
- Metric difference is below threshold
- Test duration has not elapsed (when configured)

## API

- `createExperiment` — configure A/B test on campaign version
- `evaluateExperiment` — compute result (does not auto-apply winner to remaining sends)
