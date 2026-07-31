# Lifecycle Agent Safety

Guardrails in `src/lib/lifecycle-agent/guardrails.ts` and action evaluation in `src/lib/lifecycle-agent/actions.ts` prevent unreliable or unsafe recommendations and CRM mutations.

## Blocked Conditions

| Condition | Effect |
|-----------|--------|
| LOW data confidence | Material recommendations suppressed entirely |
| Personal lead data (PII) in input | Analysis blocked entirely |
| Prompt injection detected | Analysis blocked entirely |
| Prohibited commercial actions in user notes | Analysis blocked entirely |

## Warning Conditions

| Condition | Effect |
|-----------|--------|
| Stale CRM data (>48h) | Warning added; DATA_STALE finding created |
| Incomplete owner coverage | Warning added to guardrails and evidence |
| Consent policy restricts outreach | Consent restriction recorded; outreach actions flagged |
| Leads with suppression/consent issues | Consent restriction count incremented |

## Prohibited Autonomous Actions

The following actions are never applied autonomously:

- `AUTO_SEND_MESSAGE` — messages require human review and manual send
- `AUTO_PRICE_CHANGE` — price changes require explicit human approval
- `AUTO_DISCOUNT` — discounts require explicit human approval
- `AUTO_DEAL_WON` — won status requires authorised confirmation and evidence
- `AUTO_LIFECYCLE_CHANGE` — lifecycle stage changes require approval
- `AUTO_STAGE_CHANGE` — pipeline stage changes blocked from LLM output

## Commercial Safety Guards

```
blockAutonomousSend()        — messages never sent without manual action
blockAutonomousPriceChange() — price changes never applied autonomously
blockAutonomousDealWon()     — deals never marked won without evidence + approval
```

## Action-Level Guards

`evaluateActionProposal()` blocks:

- Autonomous send (`autoSend: true` or `autonomous: true` on DRAFT_MESSAGE)
- Price change payloads (`actionType: PRICE_CHANGE`, `priceChange` field)
- Discount payloads (`actionType: DISCOUNT`, `discount` field)
- Deal-won payloads (`markWon: true`, `status: WON`)
- `REQUEST_STAGE_CHANGE` from LLM output
- `REQUEST_OWNER_ASSIGNMENT` from LLM output (requires human review)
- Any autonomous non-informational action

All material action classes require human approval before application.

## Consent Evaluation

`evaluateConsentForOutreach()` checks:

- Suppressed or unsubscribed contacts → blocked
- Explicit consent not granted (when required) → blocked
- Marketing consent not recorded (when required) → blocked

## Prompt Injection

User notes are sanitised via `sanitiseAnalysisNotes()` using patterns from `src/lib/ai/prompt-injection.ts`. Blocked inputs prevent run execution.

## PII Detection

Email and phone patterns in user notes block analysis to prevent personal lead data from entering the lifecycle pipeline.

## Prioritisation Safety

Priority scoring explicitly excludes deal value (`monetaryValueExcluded: true`). Factors are lifecycle stage, urgency, inactivity, deadlines, rule-based lead score, data confidence, and consent — not monetary value.

## Disclaimers

- `LIFECYCLE_DISCLAIMER` — recommendations are proposals only; no autonomous CRM changes
- `NO_AUTONOMOUS_ACTION_DISCLAIMER` — agent must not autonomously send, price, or close deals
