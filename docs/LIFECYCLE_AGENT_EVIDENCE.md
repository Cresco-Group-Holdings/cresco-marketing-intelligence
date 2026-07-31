# Lifecycle Agent Evidence

Every lifecycle agent run persists a `LifecycleAgentEvidence` record and builds an in-memory `EvidencePackage` via `buildEvidencePackage()`.

## Required Evidence Fields

| Field | Description |
|-------|-------------|
| `analysisDate` | Timestamp of analysis execution |
| `dateRangeStart` / `dateRangeEnd` | Primary analysis window |
| `brandId` / `organisationId` | Tenant scope |
| `scope` | Scoped filters (pipeline, owner, lifecycle stages) |
| `leadCount` / `opportunityCount` | Record counts in scope |
| `openOpportunityCount` | Opportunities with OPEN status |
| `overdueTaskCount` | Tasks past due and not completed |
| `unownedLeadCount` | Leads without assigned owner |
| `staleOpportunityCount` | Open opportunities without recent activity |
| `trialEndingCount` | Trials ending within warning window |
| `renewalApproachingCount` | Renewals within approaching window |
| `metrics` | Computed CRM metrics (counts, averages) |
| `metricDefinitions` | Human-readable definitions for each metric |
| `freshnessHours` | CRM data age in hours |
| `qualityWarnings` | Data quality warnings |
| `dataConfidenceLevel` | LOW / MEDIUM / HIGH classification |
| `consentRestrictedCount` | Leads with consent or suppression restrictions |
| `recentActivities` | Recent logged CRM activities (up to 20) |
| `scopeSummary` | Human-readable scope description |

## Metric Definitions

Key metrics include:

- `leadCount` — total leads in analysis scope
- `openOpportunityCount` — opportunities with OPEN status
- `overdueTaskCount` — tasks past due date and not completed
- `avgLeadScore` — average lead score (rule-based, not predictive)
- `avgPurchaseLikelihood` — heuristic purchase estimate (not proven)
- `avgChurnLikelihood` — heuristic churn estimate (not proven)

## Predictive Signal Disclaimers

All likelihood scores are transparent rule-based estimates:

- `predictiveSignalDisclaimer` — general disclaimer for all likelihood indicators
- `churnLikelihoodDisclaimer` — churn estimates are heuristic, not proven facts
- `purchaseLikelihoodDisclaimer` — purchase estimates are heuristic, not proven facts

## Data Confidence Classification

`classifyDataConfidence()` assigns confidence based on:

| Level | Conditions |
|-------|------------|
| LOW | 3+ quality warnings, or zero activities in scope |
| MEDIUM | 1–2 warnings, or fewer than 3 activities |
| HIGH | No warnings and sufficient activity history |

When confidence is LOW, material recommendations are suppressed by guardrails.

## Evidence Builder

`buildEvidencePackage()` in `src/lib/lifecycle-agent/evidence.ts` constructs the package from `LifecycleAnalysisInput`.

## Grounded Explanations

`generateExplanation()` in `src/lib/lifecycle-agent/ai-assistant.ts` produces grounded explanations that:

- Reference evidence metrics and scope
- Set `grounded: true`, `modifiesScore: false`, `modifiesThresholds: false`
- Include predictive signal disclaimers where applicable

## Usage

Evidence is attached to every run and displayed on recommendation detail pages. Findings reference evidence strength; recommendations include data-quality state and missing-data indicators derived from the evidence package.
