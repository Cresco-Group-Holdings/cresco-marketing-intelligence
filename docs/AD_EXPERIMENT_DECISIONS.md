# Ad Experiment Decisions

Human-approved decisions with explicit outcomes and limitations.

## Outcomes

| Outcome | Description | Approval required |
|---|---|---|
| `ADOPT_VARIANT` | Deploy winning variant | Yes |
| `KEEP_CONTROL` | Retain control | No |
| `CONTINUE_TEST` | Extend test duration | No |
| `RUN_FOLLOWUP` | Design follow-up experiment | No |
| `INCONCLUSIVE` | Insufficient evidence | No |
| `INVALID_TEST` | Critical validity issues | No |
| `STOP_FOR_SAFETY` | Guardrail violation | No |

## Approval workflow

1. Run analysis to compute results and validity checks
2. Record decision with recommendation and limitations
3. For `ADOPT_VARIANT`: a separate user must approve the decision
4. Approval is blocked when critical validity issues exist

## Confidence note

Every decision includes a `confidenceNote`:
- Default: "Results are observational unless a documented valid statistical method was applied."
- When significance is claimed: includes normal-approximation disclaimer

## Limitations

Decision `limitations` field is required and must document:
- Validity warnings that affected interpretation
- Whether randomisation was guaranteed
- Sample size adequacy
- Any confounding factors

## Material changes

Changing budget, audience, destination, creative, schedule, or objective during a running experiment invalidates the test and should result in `INVALID_TEST` or `INCONCLUSIVE`.
