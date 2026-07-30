# Internal Link Rules

Deterministic issue detection rules applied during graph build. Thresholds live in `src/lib/internal-links/constants.ts`.

## Orphan & near-orphan

| Issue | Condition |
|-------|-----------|
| `ORPHAN_PAGE` | Indexable page with 0 incoming internal links (excluding designated home) |
| `NEAR_ORPHAN_PAGE` | Indexable page with 1 incoming internal link |

## Link quality

| Issue | Condition |
|-------|-----------|
| `BROKEN_INTERNAL_LINK` | Edge `isBroken = true` (4xx/5xx/unresolvable) |
| `LINK_TO_REDIRECT` | Edge `isRedirect = true` |
| `LINK_TO_NOINDEX` | Edge `targetIsNoindex = true` |
| `OBSOLETE_LINK` | Target URL no longer in crawl inventory |

## Structure

| Issue | Condition |
|-------|-----------|
| `EXCESSIVE_CRAWL_DEPTH` | `crawlDepth > MAX_CRAWL_DEPTH` (default 6) |
| `EXCESSIVE_REPEATED_ANCHOR` | Same anchor text used ≥ `ANCHOR_REPETITION_WARN` times (default 5) |
| `DISCONNECTED_TOPIC_CLUSTER` | Cluster has >1 member but no internal edges between members |
| `LOW_INTERNAL_SUPPORT` | High traffic/authority page with ≤2 incoming links |

## Canonical

| Issue | Condition |
|-------|-----------|
| `CONFLICTING_CANONICAL` | Page canonical points to another indexed page in graph with different URL |

## Anchor classification

Anchors are classified — never forced to exact-match:

| Type | Examples |
|------|----------|
| `BRANDED` | Contains brand name |
| `PARTIAL_MATCH` | Contains target keywords partially |
| `GENERIC` | "click here", "read more", "learn more" |
| `NAVIGATIONAL` | Menu/breadcrumb style |
| `DESCRIPTIVE` | Natural descriptive phrase |
| `IMAGE` | Image alt / empty with image link |
| `EMPTY` | No anchor text |

Unnatural repetition triggers `EXCESSIVE_REPEATED_ANCHOR` when the same normalized anchor exceeds the site-wide threshold.

## Severity

- **CRITICAL** — broken links, conflicting canonicals on important pages
- **HIGH** — orphans on indexable content, links to noindex
- **MEDIUM** — redirect links, near-orphans, excessive depth
- **LOW** — generic anchors, weak cluster connectivity
