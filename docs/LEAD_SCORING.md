# Lead Scoring

Deterministic, rule-based lead scoring for fit, engagement, and negative signals with versioned models, evidence-backed breakdowns, and qualification mapping.

## Architecture

```
┌──────────────────┐     ┌─────────────────────┐     ┌────────────────────────┐
│ CRM lead snapshot│────▶│ Rule engine         │────▶│ Composite score +      │
│ (fit, engagement,│     │ (groups, caps, decay)│     │ qualification status   │
│  negative fields) │     └─────────────────────┘     └────────────────────────┘
└──────────────────┘                │                            │
                                  ▼                            ▼
                         ┌─────────────────┐          ┌──────────────────┐
                         │ Safety review   │          │ AI explanations  │
                         │ (prohibited     │          │ (grounded only,  │
                         │  attributes)    │          │  no score change)│
                         └─────────────────┘          └──────────────────┘
```

### Core modules

| Module | Location | Responsibility |
|--------|----------|----------------|
| Signals | `src/lib/lead-scoring/signals.ts` | Approved signal registry and snapshot field mapping |
| Rules | `src/lib/lead-scoring/rules.ts` | Rule and group evaluation with operators |
| Scoring | `src/lib/lead-scoring/scoring.ts` | Category and composite score computation |
| Decay | `src/lib/lead-scoring/decay.ts` | Linear and exponential evidence decay |
| Qualification | `src/lib/lead-scoring/qualification.ts` | Threshold mapping and missing-info detection |
| Safety | `src/lib/lead-scoring/safety.ts` | Prohibited attributes and model review checklist |
| Simulation | `src/lib/lead-scoring/simulation.ts` | What-if analysis across lead cohorts |
| AI assistant | `src/lib/lead-scoring/ai-assistant.ts` | Grounded explanations and follow-up suggestions |
| Service | `src/server/services/lead-scoring-service.ts` | Tenant-scoped model and score persistence |

## Score types

| Type | Default cap | Description |
|------|-------------|-------------|
| FIT | 100 (category 60) | ICP alignment — industry, geography, company size |
| ENGAGEMENT | 100 (category 60) | Buying intent — email, pages, demos, trials |
| NEGATIVE | -50 (category -30) | Disqualification signals — unsubscribe, bounce, suppression |
| COMPOSITE | 100 | `fit + engagement + negative`, floored at 0 |

## Signal categories

- **FIT** (10 signals): `TARGET_INDUSTRY`, `TARGET_COUNTRY`, `COMPANY_SIZE_MATCH`, `PRODUCT_INTEREST_MATCH`, `REVENUE_BAND_MATCH`, `EMPLOYEE_COUNT_MATCH`, `ACCOUNT_TYPE_MATCH`, `LANGUAGE_MATCH`, `LIFECYCLE_STAGE_FIT`, `TAG_FIT`
- **ENGAGEMENT** (12 signals): `EMAIL_OPEN`, `EMAIL_CLICK`, `PAGE_VIEW`, `CONTENT_DOWNLOAD`, `FORM_SUBMISSION`, `DEMO_REQUESTED`, `TRIAL_STARTED`, `MEETING_BOOKED`, `RECENT_ACTIVITY`, `HIGH_EMAIL_ENGAGEMENT`, `PRODUCT_EVENT`, `CAMPAIGN_RESPONSE`
- **NEGATIVE** (10 signals): `EMAIL_UNSUBSCRIBED`, `CONSENT_WITHDRAWN`, `SUPPRESSED`, `INACTIVE`, `BOUNCED_EMAIL`, `DISQUALIFIED_STATUS`, `NEGATIVE_TAG`, `COMPETITOR_TAG`, `SUPPORT_ISSUE`, `CHURNED_SUBSCRIPTION`

## Rule operators

`eq`, `ne`, `in`, `not_in`, `gt`, `gte`, `lt`, `lte`, `contains`, `exists`

Group logic: `AND` (all rules must match; points summed) or `OR` (any match; points summed).

## Model lifecycle

`DRAFT` → `IN_REVIEW` → `APPROVED` → `ACTIVE` → `PAUSED` / `ARCHIVED`

Only `ACTIVE` models score leads in production. Simulations run against draft or approved versions before activation.

## API

`GET/POST /api/brands/{brandId}/lead-scoring?organisationId={orgId}`

| Action | Permission | Description |
|--------|------------|-------------|
| `createModel` | `leadScoring.create` | Create a draft scoring model |
| `scoreLead` | `leadScoring.edit` | Compute and persist score for a lead |
| `overrideQualification` | `leadScoring.override` | Manual qualification override with audit trail |

GET: list models or fetch model by `modelId`.

## Data model

- `LeadScoringModel` — brand-scoped model with status and active version
- `LeadScoringModelVersion` — immutable rule snapshot
- `LeadScoringRuleGroup` / `LeadScoringRule` — versioned rule configuration
- `LeadScoreSnapshot` — point-in-time score for a lead
- `LeadScoreContribution` — per-rule evidence and capped contribution
- `LeadQualificationModel` / `LeadQualificationResult` — qualification thresholds and outcomes
- `LeadQualificationOverride` — manual override audit record
- `LeadScoringSimulation` — simulation run results

## Related documentation

- [LEAD_QUALIFICATION.md](./LEAD_QUALIFICATION.md) — qualification statuses and thresholds
- [LEAD_SCORING_SAFETY.md](./LEAD_SCORING_SAFETY.md) — prohibited attributes and review checklist
- [LEAD_SCORING_SIMULATION.md](./LEAD_SCORING_SIMULATION.md) — simulation workflow
