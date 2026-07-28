# AI Cost Controls

Task 1.7 provides cost guardrails without billing integration.

## Per-request limits

- maximum input size: 12,000 characters
- per-request token budget: 8,000 tokens (estimated)
- default max output tokens: 1,024

## Daily budgets

| Scope | Default daily token budget |
| --- | --- |
| Organisation | 250,000 tokens |
| User | 50,000 tokens |

When a budget is exceeded, the service returns a rate-limited error.

## Model allowlist

Only models marked `available` in `AIModelRegistry` may be executed.

Unconfigured providers fall back to the mock model in non-production environments.

## Cost estimation

Estimated request cost is calculated from registry metadata:

```
(inputTokens / 1000 * inputCostPer1k) + (outputTokens / 1000 * outputCostPer1k)
```

Costs are stored on:

- `AIRequest`
- `AIExecution`
- `AIUsageRecord`

## Usage dashboard foundation

`GET /api/ai/usage` returns:

- organisation requests today
- organisation tokens today
- estimated organisation cost today
- remaining organisation and user token budgets

## Extension points

The architecture includes extension points for:

- budget warning notifications
- per-purpose budgets
- hard spend caps by environment

Billing and invoicing are out of scope for Task 1.7.
