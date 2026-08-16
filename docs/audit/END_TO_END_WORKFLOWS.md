# End-to-End Workflows Audit

**Main SHA:** `8910740` | **Audit date:** 2026-08-16

Classification: **E2E WORKING** | **BACKEND ONLY** | **UI ONLY** | **PARTIAL** | **MOCKED** | **BROKEN** | **UNKNOWN**

---

## UI → API → DB Trace Methodology

Each workflow traced through: UI component → fetch/action → API route → `withApiHandler` + permission → `buildTenantContext` → service → Prisma → response.

---

## Major user actions

### Create organisation (onboarding)

| Step | Path | Status |
|------|------|--------|
| UI | `onboarding-wizard.tsx` | E2E WORKING |
| API | `POST /api/onboarding` | E2E WORKING |
| Auth | Supabase session | E2E WORKING |
| Service | `onboarding-service.ts` | E2E WORKING |
| DB | Organisation, Project, Brand, Membership | E2E WORKING |

### Create campaign

| Step | Status |
|------|--------|
| UI wizard → `campaigns-view.tsx` | E2E WORKING |
| API `POST /api/campaigns` | E2E WORKING |
| Permission `campaign.create` | E2E WORKING |
| Service `campaign-service.ts` | E2E WORKING |
| DB `Campaign` + related | E2E WORKING |

### Create content → approve

| Step | Status |
|------|--------|
| UI `/content` | E2E WORKING |
| API content CRUD | E2E WORKING |
| Compliance `compliance-agent-service` | E2E WORKING (rule-based) |
| Approval transitions | E2E WORKING |
| Gap: schedule not wired from UI | PARTIAL |

### Connect social account

| Step | Status |
|------|--------|
| UI `/social/connections` | UI ONLY (connect button works) |
| API OAuth start | BACKEND ONLY |
| Adapter | **MOCKED** (`mock-social-adapter`) |
| Token storage | MOCKED tokens stored encrypted |
| **Verdict** | **MOCKED** — not real customer connect |

### Schedule content for publish

| Step | Status |
|------|--------|
| UI Content Studio | **NOT IMPLEMENTED** |
| API `POST .../schedule` | BACKEND ONLY |
| `ContentSchedule` row | BACKEND ONLY |
| **Verdict** | **BACKEND ONLY** |

### Publish scheduled content

| Step | Status |
|------|--------|
| Cron/worker `publishing-scheduler` | BACKEND ONLY (needs worker secret) |
| `publishing-worker.ts` | BACKEND ONLY |
| Real HTTP adapters | BACKEND ONLY (code real; tokens mock) |
| Result persistence | BACKEND ONLY |
| **Verdict** | **PARTIAL** — pipeline exists; not product E2E |

### Publish via Publication Platform UI

| Step | Status |
|------|--------|
| UI `/publishing` composer | UI ONLY |
| `publication-execution-service` | MOCKED (mock-social) |
| **Verdict** | **MOCKED** |

### Launch Google Ads campaign

| Step | Status |
|------|--------|
| UI `/advertising/google/**` | PARTIAL |
| API advertising routes | BACKEND ONLY |
| Real `google-ads/mutate-client.ts` | BACKEND ONLY (needs live connector) |
| **Verdict** | **PARTIAL** |

### Run AI content generation

| Step | Status |
|------|--------|
| UI content generate | PARTIAL |
| `content-generation-service` | E2E WORKING with MOCK LLM |
| Saved `ContentItem` | E2E WORKING |
| **Verdict** | **MOCKED** (without API keys) |

### Create automation workflow + execute

| Step | Status |
|------|--------|
| UI `/automation-engine` | PARTIAL (demo payload) |
| API `createWorkflow`, `manualExecute` | E2E WORKING |
| Action execution (CREATE_TASK, etc.) | E2E WORKING |
| Event trigger from campaign activation | **NOT WIRED** |
| **Verdict** | **PARTIAL** |

### View analytics dashboard

| Step | Status |
|------|--------|
| UI `/analytics/**` | PARTIAL |
| API facts/snapshots | BACKEND ONLY |
| Live provider data | PARTIAL (depends on sync) |
| **Verdict** | **PARTIAL** |

---

## Phase 4 — Product workflow assessment

### WORKFLOW A — Organic Social

| Step | Status | Evidence |
|------|--------|----------|
| Create brand | WORKING | Onboarding + brands API |
| Create content | WORKING | Content studio |
| Generate/adapt copy | MOCKED/PARTIAL | AI mock default |
| Attach media | PARTIAL | DAM + content variants |
| Select social channel | PARTIAL | Connections UI; mock tokens |
| Schedule | MISSING (UI) | API only |
| Publish | PARTIAL | Worker + real adapters; mock creds |
| Capture publication result | WORKING | PublishingJob fields |
| Collect metrics | PARTIAL | Real analytics adapters; needs sync |
| Analytics/report | PARTIAL | Social analytics services |

**Overall: PARTIAL (≈40% E2E)**

### WORKFLOW B — Paid Advertising

| Step | Status |
|------|--------|
| Create campaign | WORKING |
| Select advertising provider | PARTIAL (connectors) |
| Create/select ad account | PARTIAL |
| Audience/targeting | WORKING (backend) |
| Budget | WORKING |
| Creative | WORKING |
| Launch | PARTIAL (needs tokens + approvals) |
| Sync performance | PARTIAL (reporting adapters real) |
| Analyse CPA/CPC/CTR/ROAS | PARTIAL (models + UI) |
| Optimisation recommendations | WORKING (rule-based agent) |

**Overall: PARTIAL (≈55% E2E)**

### WORKFLOW C — AI Content

| Step | Status |
|------|--------|
| Brand knowledge | WORKING |
| Prompt/context | WORKING |
| AI generation | MOCKED default |
| Variants | WORKING |
| Approval | WORKING |
| Calendar | WORKING |
| Publication | PARTIAL (see Workflow A) |

**Overall: PARTIAL (≈50% E2E)**

### WORKFLOW D — Marketing Automation

| Step | Status |
|------|--------|
| Trigger | PARTIAL (manual API only for Engine; journeys separate) |
| Conditions | WORKING |
| Action | WORKING |
| Execution | WORKING (manual) |
| Retry | WORKING |
| Result | WORKING |
| Notification | WORKING |
| Audit | WORKING |

**Overall: PARTIAL (≈45% E2E for Engine; journeys ~60%)**

### WORKFLOW E — Analytics

| Step | Status |
|------|--------|
| Provider | PARTIAL |
| Data ingestion | PARTIAL |
| Normalization | WORKING (warehouse services) |
| Storage | WORKING (schema) |
| Aggregation | WORKING |
| Dashboard | PARTIAL |
| Recommendation | PARTIAL (growth, analyst) |

**Overall: PARTIAL (≈50% E2E)**

---

## Organic vs Paid separation (Phase 5)

| Dimension | Separated? | Evidence |
|-----------|------------|----------|
| Data models | **YES** | `SocialConnection` vs `ConnectorAccount`; `ContentSchedule` vs `AdvertisingCampaignSchedule` |
| UI | **YES** | `/social` vs `/advertising` |
| Provider capabilities | **YES** | `SocialProvider` vs `ConnectorType`; `channel-classification.ts` |
| Permissions | **YES** | `socialConnections.*` vs `advertising*.*` |
| Analytics | **YES** | `ORGANIC_SOCIAL` vs `PAID_SOCIAL` in warehouse |
| Campaign economics | **YES** | Separate KPI/spend models |
| **Risk** | Publication `operationType` enum mixes social + ad in one table; execution path determines behavior |

**Verdict:** Architecture properly separates organic and paid at model/UI level. Publication platform table is unified but operation types are explicit.

---

## Backend without UI (selected)

- Content schedule API
- Most integration sync admin APIs
- Agent approval decide API (limited UI)
- SEO raw data viewers
- Marketing warehouse reprocess endpoints
- Publishing job manual process endpoint

## UI without real backend (selected)

- `/social` landing (claims future work)
- `/publishing` composer (mock gateway)
- `/integrations` (disabled providers)
- AI Agents nav `comingSoon` while page exists
- External calendar sync UI placeholders
