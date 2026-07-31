# Lead Qualification

Maps computed lead scores and CRM data completeness to actionable qualification statuses for sales and marketing routing.

## Qualification statuses

| Status | Composite score | Meaning |
|--------|-----------------|---------|
| `UNASSESSED` | — | No scoring model applied yet |
| `NEEDS_INFO` | any | Required CRM fields missing |
| `COLD` | 0–24 | Low fit and engagement |
| `WARM` | 25–49 | Moderate interest |
| `HOT` | 50–74 | Strong buying signals |
| `QUALIFIED` | 75–100 | Meets sales-ready threshold |
| `DISQUALIFIED` | < 0 or suppressed | Excluded from outreach |

Thresholds are defined in `QUALIFICATION_THRESHOLDS` (`src/lib/lead-scoring/constants.ts`).

## Required fields

Before a lead can receive a score-based status (other than `NEEDS_INFO`), these fields must be present:

| Category | Fields |
|----------|--------|
| Fit | `country`, `productInterest` |
| Engagement | `lastActivityAt` |
| Consent | `consentMarketing` (must be defined) |

Missing fields produce `NEEDS_INFO` with a list of gaps in the qualification result.

## Automatic disqualification

Leads are disqualified without threshold evaluation when:

- `suppressed === true` — on suppression list
- `status === "DISQUALIFIED"` or `qualificationState === "DISQUALIFIED"`
- Composite score falls below zero after negative signals

Consent withdrawal (`consentMarketing === false`) or unsubscribe adds a reason but does not alone change the status band unless combined with negative scoring or suppression rules.

## Confidence levels

| Level | Condition |
|-------|-----------|
| `LOW` | 3+ missing fields or zero matched rules |
| `MEDIUM` | Some missing fields or fewer than 3 matched rules |
| `HIGH` | Complete data with 3+ matched rules |

## Manual overrides

Users with `leadScoring.override` can set qualification status manually. Overrides:

- Require `resultId` and `newStatus`
- Record `previousStatus`, reason, and acting user
- Do not retroactively change the underlying score snapshot
- Are stored in `LeadQualificationOverride` for audit

API action: `overrideQualification` on the lead scoring route.

## Qualification models

`LeadQualificationModel` links to a `LeadScoringModel` and stores threshold configuration. `LeadQualificationResult` binds a lead to the computed score snapshot and resolved status.

## AI follow-up suggestions

The AI assistant (`suggestFollowUp`) recommends next actions based on qualification status:

| Status | Suggestion |
|--------|------------|
| `NEEDS_INFO` | Collect missing fields (HIGH priority) |
| `HOT` / `QUALIFIED` | Prioritise sales outreach (HIGH) |
| `WARM` | Continue nurture sequence (MEDIUM) |
| `COLD` | Consider re-engagement campaign (LOW) |

Suggestions are grounded explanations only — they never auto-apply status changes.

## Permissions

| Permission | Roles |
|------------|-------|
| `leadScoring.read` | Owner, Admin, Marketer, Analyst, Viewer |
| `leadScoring.override` | Owner, Admin, Marketer |
| `leadScoring.approve` | Owner, Admin |

See [LEAD_SCORING.md](./LEAD_SCORING.md) for the full permission matrix.
