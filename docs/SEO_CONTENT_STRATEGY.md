# SEO Content Strategy

Versioned content strategy built from topic clusters, pillar/supporting structure, and priority scores.

## Workflow

1. Run clustering on brand keywords (`POST /clusters?action=cluster`)
2. Review and confirm proposed clusters
3. Request AI strategy proposal (requires approval)
4. Create pillar and supporting pages per cluster
5. Create named strategy with version 1 snapshot
6. Score clusters for prioritisation
7. Move roadmap items through statuses

## Pillar and supporting content

Content format types:

- `PILLAR` — hub page for a cluster
- `SUPPORTING_ARTICLE`, `GUIDE`, `FAQ`, `GLOSSARY`, `CASE_STUDY`, etc.
- Manual override via `isManualOverride`

Each item tracks:

- `funnelStage` — awareness through support
- `roadmapStatus` — IDEA through PUBLISHED
- `contentItemId` — link to Content Operations (Stage 2)

## Strategy versioning

- Each strategy has numbered versions (`SeoContentStrategyVersion`)
- Versions store cluster snapshots and AI proposals
- Approval sets `isApproved` and activates strategy
- Historical versions preserved for audit

## AI proposals

AI may suggest cluster names, pillar structure, supporting sequence, audience questions, and differentiation angles. All proposals:

- Include evidence references
- Require explicit user approval before application
- Are stored in strategy version `aiProposals` field
