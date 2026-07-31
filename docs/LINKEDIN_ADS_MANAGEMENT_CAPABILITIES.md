# LinkedIn Ads Management — Capability Audit (Task 5.6)

Last reviewed: 2026-07-30

## Official API support

| Capability | Status in Cresco | Notes |
|---|---|---|
| Marketing Developer Platform | Enabled | Required for API access |
| OAuth (`r_ads`, `rw_ads`) | Enabled | Via existing connector |
| Ad account listing | Enabled | Explicit selection required |
| Campaign creation | Enabled | Controlled launch only |
| Sponsored content | Enabled | Initial scope |
| Single-image ads | Enabled | |
| Video ads | Enabled | |
| Document ads | **Disabled** | Not verified in initial scope |
| Lead-generation ads | Enabled | Requires pre-configured form |
| Website visits objective | Enabled | |
| Lead generation objective | Enabled | |
| Engagement objective | Enabled | |
| Job-function targeting | Enabled | |
| Seniority targeting | Enabled | |
| Industry targeting | Enabled | |
| Company size targeting | Enabled | |
| Location targeting | Enabled | |
| Language targeting | Enabled | |
| Insight Tag conversion tracking | Enabled | Read-only setup |
| Lead forms | Enabled | Extension point |
| Custom audiences | Enabled | Via audience intelligence |
| Matched audiences | **Disabled** | Separate upload workflow |
| Test ad accounts | Enabled | Flagged in account metadata |
| Policy review | Enabled | Local + provider status |

## Restrictions

- No autonomous launch or budget changes
- No discriminatory employment targeting (age, gender, race, religion blocked locally)
- Local validation does not guarantee LinkedIn policy approval

## Rate limits

- Application-level daily/throttled quotas; `429` with `Retry-After`
- Handled via error recovery classification

## App review

- Marketing Developer Platform access required
- `rw_ads` scope needed for campaign mutations
