# Lead Scoring Safety

Safety controls prevent discriminatory scoring, runaway point inflation, and non-deterministic black-box models.

## Deterministic scoring only

All scores are computed from explicit rules. No ML or opaque AI models contribute to the numeric score.

> Lead scores are deterministic rule-based calculations. No black-box AI scoring is applied.

The AI assistant provides explanations and suggestions only — it cannot modify scores or qualification status (`modifiesScore: false`, `autoApplyBlocked: true`).

## Prohibited attributes

Rules must not reference protected or sensitive personal attributes. The following fields are blocked at rule evaluation and safety validation time:

| Category | Blocked fields |
|----------|----------------|
| Demographics | `race`, `ethnicity`, `gender`, `sex`, `age`, `dateOfBirth`, `birthDate`, `nationalOrigin`, `maritalStatus` |
| Health | `disability`, `healthStatus`, `pregnancy`, `geneticInformation` |
| Sensitive | `religion`, `sexualOrientation` |
| Financial | `personalIncome`, `creditScore` |
| Location (granular) | `postalCode`, `zipCode`, `homeAddress` |

Validation functions:

- `isProhibitedAttribute(field)` — case-insensitive check
- `validateRuleSafety(rule)` — per-rule validation
- `validateModelSafety(model)` — full model review with checklist

Rules referencing prohibited fields match nothing and award zero points.

## Platform limits

| Limit | Value | Purpose |
|-------|-------|---------|
| `MAX_POINTS_PER_RULE` | 50 | Cap single-rule contribution |
| `MAX_RULES_PER_GROUP` | 25 | Prevent oversized groups |
| `MAX_RULES_PER_MODEL` | 100 | Bound model complexity |

## Score caps

Caps are applied at three levels to prevent score inflation:

1. **Group cap** — limits total points from a rule group; scales individual evidence proportionally
2. **Category cap** — limits FIT (60), ENGAGEMENT (60), NEGATIVE (-30) totals
3. **Score type cap** — limits FIT (100), ENGAGEMENT (100), NEGATIVE (-50), COMPOSITE (100)

When caps are applied, `capsApplied` in the score breakdown lists which limits fired (e.g. `group:fit-group`, `category:FIT`, `score:COMPOSITE`).

## Model review checklist

`validateModelSafety` runs a checklist before model approval:

| Check | Requirement |
|-------|-------------|
| `has_fit_rules` | At least one FIT rule group |
| `has_engagement_rules` | At least one ENGAGEMENT rule group |
| `no_prohibited_attributes` | No prohibited field references |
| `caps_configured` | Group or model caps defined |
| `negative_signals_present` | Recommended (warning only) |
| `rule_count_within_limits` | ≤ 100 total rules |
| `deterministic_only` | Always passes (disclaimer acknowledgement) |

Failed checklist items (except optional negative signals) block `safe: true`.

## Approved signals only

Rules must use signals from the approved registry (`ALL_SIGNALS`). Unknown signals are rejected at validation and evaluate to zero points.

Custom `field` overrides on rules are validated against the prohibited attribute list but should generally use the signal's default snapshot field.

## Negative signal handling

Negative rules use negative point values. Category caps for NEGATIVE use `Math.max` (floor) rather than `Math.min` (ceiling) so penalties cannot exceed the configured floor.

Suppressed or unsubscribed leads should have negative rules configured to ensure composite scores reflect outreach eligibility.

## Incident response

If a model is found to reference prohibited attributes after deployment:

1. Pause the model (`PAUSED` status)
2. Review `LeadScoreSnapshot` and `LeadScoreContribution` for affected leads
3. Correct rules and run a simulation before re-activation
4. Document the override in audit logs

See [LEAD_SCORING_SIMULATION.md](./LEAD_SCORING_SIMULATION.md) for pre-activation testing workflow.
