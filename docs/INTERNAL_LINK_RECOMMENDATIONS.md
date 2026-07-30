# Internal Link Recommendations

## Generation signals

Recommendations combine:

1. **Semantic relevance** — shared keywords between source and target
2. **Topic cluster** — same-cluster pages not yet linked
3. **User journey** — hub → spoke, category → article patterns
4. **Page authority** — high-authority pages as link sources
5. **Keyword mapping** — target page primary keyword informs anchor *concept*
6. **Missing support** — orphan/weakly-linked targets prioritised
7. **Content context** — page type compatibility (hub linking to articles, etc.)

## Recommendation fields

Every `InternalLinkRecommendation` includes:

| Field | Description |
|-------|-------------|
| `sourceNodeId` | Page that should add the link |
| `targetNodeId` | Page that should receive the link |
| `suggestedAnchorConcept` | Natural phrase concept — **not** forced exact-match |
| `contextualReason` | Human-readable justification |
| `confidence` | 0–1 score from signal strength |
| `evidence` | JSON array of supporting facts |
| `potentialConflict` | Flag if link may compete with existing nav/canonical |

## Anchor policy

- Suggest **descriptive or partial-match** anchor concepts
- Never recommend exact-match keyword stuffing
- Flag when proposed concept overlaps with over-used anchors on site

## Change proposals

Users manage recommendations via `InternalLinkChangeProposal`:

| Status | Meaning |
|--------|---------|
| `PENDING` | Awaiting review |
| `APPROVED` | Accepted for implementation |
| `REJECTED` | Declined with optional reason |
| `EDITED` | User modified anchor or target |
| `ASSIGNED` | Assigned to team member |
| `EXPORTED` | Exported for CMS implementation |
| `IMPLEMENTED` | Marked done by user |
| `VERIFIED` | Confirmed in subsequent crawl build |

**No automatic website modification** — proposals are workflow items only.

## Verification

On a new graph build after implementation:

1. Build service checks if approved proposal's edge now exists
2. Matching edges update proposal status to `VERIFIED`
3. Missing edges remain `IMPLEMENTED` until next verification pass

## API

- `GET .../internal-links/{graphId}/recommendations` — list recommendations
- `POST .../internal-links/{graphId}` with `{ action: "propose", recommendationId, status }` — manage proposals
