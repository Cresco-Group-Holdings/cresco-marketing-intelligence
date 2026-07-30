# SEO Crawl Configuration

## Fields

| Field | Default | Description |
|-------|---------|-------------|
| `startUrls` | `[https://{domain}/]` | Entry points |
| `allowedDomains` | `[primaryDomain]` | SSRF allowlist |
| `allowedSubdomains` | `true` | Include subdomains |
| `maxPages` | 500 | Hard page limit |
| `maxDepth` | 5 | Link-following depth |
| `requestConcurrency` | 2 | Parallel requests |
| `requestDelayMs` | 500 | Per-request delay |
| `requestTimeoutMs` | 15000 | Fetch timeout |
| `redirectLimit` | 5 | Max redirect hops |
| `userAgent` | `CrescoSEOBot/1.0` | Crawler identity |
| `respectRobotsTxt` | `true` | Honor robots rules |
| `followCanonical` | `true` | Canonical policy |
| `ignoredExtensions` | `.pdf,.zip,...` | Skip asset types |

## Safety Defaults

Blocked automatically:
- localhost, private IPs, metadata endpoints
- Non-HTTP(S) protocols
- Blocked ports (22, 3306, 5432, etc.)
- Unbounded crawling (maxPages enforced)

## Extension Points

- `queryParamRules` (JSON) — custom parameter handling
- `customHeaders` (JSON) — restricted safe headers
- JavaScript rendering — not implemented in v1
- Authentication — extension point for future
