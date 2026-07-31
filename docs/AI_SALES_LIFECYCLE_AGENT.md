# AI Sales Lifecycle Agent

Task 6.9 introduces an evidence-grounded AI lifecycle agent that analyses CRM records and proposes controlled sales actions across leads, opportunities, trials, and renewals.

## Principles

1. **No autonomous material actions** — the agent never sends messages, changes pricing, marks deals as won, or applies material CRM changes without human approval.
2. **Evidence-first** — every run includes a complete evidence package (see [LIFECYCLE_AGENT_EVIDENCE.md](./LIFECYCLE_AGENT_EVIDENCE.md)).
3. **Guardrailed analysis** — stale data, low confidence, consent restrictions, and prompt injection trigger warnings or suppression (see [LIFECYCLE_AGENT_SAFETY.md](./LIFECYCLE_AGENT_SAFETY.md)).
4. **Draft-only outreach** — message drafts are validated for commercial safety; sending is always manual (see [AI_SALES_DRAFTS.md](./AI_SALES_DRAFTS.md)).
5. **Feedback loop** — user feedback and measured outcomes are tracked; effectiveness is never claimed without post-action evidence.

## Models

| Model | Purpose |
|-------|---------|
| `LifecycleAgentRun` | Review execution (daily sales, weekly pipeline, trial risk, renewal, lifecycle health) |
| `LifecycleAgentEvidence` | Evidence package for a run |
| `LifecycleAgentFinding` | Detected CRM issues or strengths |
| `LifecycleAgentRecommendation` | Proposed action with priority metadata |
| `LifecycleAgentDraft` | Validated message draft (never auto-sent) |
| `LifecycleAgentActionProposal` | Classified action requiring approval |
| `LifecycleAgentApproval` | Human approval audit trail |
| `LifecycleAgentOutcome` | Measured post-action results |
| `LifecycleAgentFeedback` | User acceptance/rejection/deferral |

## Review Types

- `DAILY_SALES_BRIEF` — daily sales priorities and overdue tasks
- `WEEKLY_PIPELINE_REVIEW` — weekly pipeline health review
- `TRIAL_RISK_REVIEW` — trial ending and inactivity signals
- `RENEWAL_REVIEW` — renewal approaching and at-risk accounts
- `LIFECYCLE_HEALTH_SUMMARY` — portfolio-level lifecycle health
- `ON_DEMAND` — scoped on-demand analysis

## Analysis Inputs

Leads, opportunities, activities, tasks, lifecycle stages, owner coverage, consent context, data quality (freshness, activity count), and optional user notes.

## API

- `GET /api/brands/[brandId]/crm/lifecycle-agent` — list runs or fetch run by `runId`
- `POST` action `startRun` — execute lifecycle review
- `GET /api/brands/[brandId]/crm/lifecycle-agent/[recommendationId]` — recommendation detail
- `POST` actions: `approveAction`, `submitFeedback`, `recordOutcome`

## Permissions

- `lifecycleAgent.read` — view runs, findings, recommendations, drafts
- `lifecycleAgent.run` — start lifecycle reviews
- `lifecycleAgent.approve` — approve action proposals
- `lifecycleAgent.feedback` — submit feedback and record outcomes

## Prioritisation

Recommendations are prioritised using lifecycle stage, urgency, inactivity, deadlines, lead score (rule-based), data confidence, and consent status. **Deal value is explicitly excluded** from priority scoring (`monetaryValueExcluded: true`).

## Related Documentation

- [LIFECYCLE_AGENT_EVIDENCE.md](./LIFECYCLE_AGENT_EVIDENCE.md)
- [LIFECYCLE_AGENT_SAFETY.md](./LIFECYCLE_AGENT_SAFETY.md)
- [AI_SALES_DRAFTS.md](./AI_SALES_DRAFTS.md)
