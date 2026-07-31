# Advertising Optimisation Guardrails

Guardrails in `src/lib/advertising-optimisation/guardrails.ts` prevent unreliable or unsafe recommendations.

## Blocked Conditions

| Condition | Effect |
|-----------|--------|
| Stale provider data (>48h) | Material recommendations blocked |
| Below minimum volume | Material recommendations blocked |
| Personal lead data in input | Analysis blocked entirely |
| Prompt injection detected | Analysis blocked entirely |

## Warning Conditions

| Condition | Effect |
|-----------|--------|
| Attribution model mismatch | Warning added; comparisons may be invalid |
| Currency mismatch | Warning added; cross-currency comparison requires FX |
| Active valid experiment | Warning: material changes may confound test |
| Material change during experiment | Warning: interpret performance cautiously |
| Tracking not confirmed | Warning: conversion metrics unreliable |

## Spend and Provider Guards

```
blockAutonomousSpendIncrease() — budget increases never applied without approval
blockDirectProviderMutation() — provider changes never applied from LLM output
```

## Action-Level Guards

`evaluateActionProposal()` blocks:

- `REQUEST_PROVIDER_CHANGE` from LLM output
- `REQUEST_BUDGET_CHANGE` from LLM output

All material action classes require human approval before application.

## Prompt Injection

User notes are sanitised via `sanitiseAnalysisNotes()` using patterns from `src/lib/ai/prompt-injection.ts`. Blocked inputs prevent run execution.

## PII Detection

Email and phone patterns in user notes block analysis to prevent personal lead data from entering the optimisation pipeline.
