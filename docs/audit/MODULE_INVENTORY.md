# Module Inventory

**Main SHA:** `8910740` | **Audit date:** 2026-08-16

Status legend: **COMPLETE** | **FUNCTIONAL BUT INCOMPLETE** | **PARTIAL** | **SCAFFOLD** | **MOCK ONLY** | **DISCONNECTED** | **BROKEN** | **NOT IMPLEMENTED**

---

## 1. Dashboard

| Attribute | Detail |
|-----------|--------|
| Status | **FUNCTIONAL BUT INCOMPLETE** |
| UI | `/dashboard`, `/dashboard/foundation` |
| API | `/api/dashboard/foundation` (membership-only; conditional audit data) |
| Services | `foundation-dashboard-service.ts` |
| Tests | `foundation-dashboard-service.test.ts` |
| Gap | No permission gate on foundation endpoint |

## 2. Brand / Brand Profile

| Status | **FUNCTIONAL BUT INCOMPLETE** |
| UI | `/brands`, `/brands/[brandId]`, profile subpages |
| API | `/api/brands/**`, `/api/brands/[brandId]/profile/**` |
| Models | `Brand`, `BrandProfile`, `BrandPersona`, `BrandVoiceRule`, etc. |
| Permissions | `brands.*`, `brandProfile.*` |
| Tests | Multiple unit/integration |

## 3. Brand Knowledge

| Status | **FUNCTIONAL BUT INCOMPLETE** |
| UI | Brand knowledge sections within brand pages |
| API | Brand-scoped knowledge routes |
| Models | `BrandOffer`, `BrandMessage`, `BrandCompetitor`, etc. |
| Note | Overlaps with Knowledge Base module |

## 4. Knowledge Base

| Status | **FUNCTIONAL BUT INCOMPLETE** |
| UI | `/knowledge`, brand KB pages |
| API | `/api/brands/[brandId]/knowledge-bases/**` |
| Migration | `20260805120000_knowledge_base_brand_intelligence` |
| Models | `KnowledgeBase`, `KnowledgeEntry`, `KnowledgeDocument` |
| Tests | `knowledge-base*.test.ts` |

## 5. Digital Asset Management

| Status | **PARTIAL** |
| UI | `/assets`, `/brands/[brandId]/assets/**` |
| API | `/api/brands/[brandId]/digital-assets/**`, `/api/digital-assets/process-due` |
| Services | `digital-asset-service.ts`, `digital-asset-processing-service.ts` |
| Jobs | Worker route exists; not on Vercel cron |
| Tests | Unit + integration present |

## 6. Content Studio

| Status | **FUNCTIONAL BUT INCOMPLETE** |
| UI | `/content`, `/content/[contentId]` |
| API | `/api/brands/[brandId]/content/**` |
| Services | `content-service.ts`, `content-generation-service.ts`, `content-operations-service.ts` |
| Models | `ContentItem`, `ContentVariant`, `ContentRevision` |
| Gap | `scheduledFor` field in UI but no schedule API wiring |

## 7. Content Generation

| Status | **PARTIAL** (MOCK LLM default) |
| API | `POST .../content/generate`, `.../ideas`, `.../regenerate` |
| Services | `content-generation-service.ts` |
| AI | `ai-request-service` → MockAIProvider without keys |
| Tests | `content-generation.test.ts` |

## 8. Campaign Management

| Status | **FUNCTIONAL BUT INCOMPLETE** |
| UI | `/campaigns`, wizard, detail |
| API | `/api/campaigns`, `/api/brands/[brandId]/campaigns/**` |
| Models | `Campaign`, `CampaignChannel`, `CampaignKpi`, `CampaignMember` |
| Migration | `20260805120000_stage_1_campaigns_core` |
| Tests | Stage 1 unit + integration |

## 9. Content Calendar

| Status | **FUNCTIONAL BUT INCOMPLETE** |
| UI | `/calendar` (full: month/week/list, drag reschedule) |
| Nav | **DISCONNECTED** — `comingSoon: true` in `dashboard-nav.ts` |
| API | `/api/calendar/events/**` (7 routes) |
| Services | `calendar-service.ts`, `calendar-projection-service.ts` |
| Models | `CalendarEvent` |
| Tests | `calendar-core.test.ts`, `calendar-stage-6.test.ts`, `calendar-routes.test.ts` (30 tests) |
| Gap | External sync contracts only |

## 10. Scheduling

| Status | **PARTIAL** |
| API | `POST .../content/[contentId]/schedule` |
| Services | `scheduling-service.ts`, `publishing-scheduler-service.ts` |
| Models | `ContentSchedule` |
| UI | **NOT IMPLEMENTED** in Content Studio |
| Worker | `/api/publishing-scheduler/process-due` |

## 11. Publishing

| Status | **DISCONNECTED** (dual paths) |
| Path A (organic) | Schedule → job → worker → real adapters — **backend COMPLETE** |
| Path B (platform) | `/publishing` → mock gateway — **MOCK ONLY** |
| UI | `/publishing`, `/operations/publishing`, partial publish panels on content detail |
| Tests | Extensive integration; E2E covers Path B only |

## 12. Social Media

| Status | **PARTIAL** |
| UI | `/social` (stub), `/social/connections` (full) |
| Connect | **MOCK ONLY** OAuth adapters |
| Publish | Real adapter code; mock connections |
| Analytics | Real pull adapters; GHA scheduler |
| Inbox | **MOCK ONLY** |

## 13. Paid Advertising

| Status | **FUNCTIONAL BUT INCOMPLETE** |
| UI | `/advertising/**` (Google, Meta, LinkedIn, TikTok, budgets, experiments) |
| API | Extensive `/api/brands/[brandId]/advertising/**` |
| Clients | Real mutate/reporting clients for 4 platforms |
| Models | Separate from organic (`ConnectorAccount`, `Advertising*`) |
| Gap | Requires live connector tokens; launch approval flows complex |

## 14. Provider Platform

| Status | **PARTIAL** |
| Registry | 30 definitions; 2 enabled + 3 mocks |
| Gateway | `platform-registry.ts` → mocks only |
| Tests | `provider-platform.test.ts`, integration tests |
| Migration | `20260805220000_provider_integration_platform` |

## 15. Provider Connections

| Status | **SCAFFOLD** |
| API | `/api/integrations/**` (20+ routes) |
| Services | `integrations-connection-service.ts`, `connection-lifecycle-service.ts` |
| UI | `/integrations` (mostly disabled providers) |
| Gap | Definitions `enabled: false`; mock token exchange |

## 16. OAuth

| Status | **MOCK ONLY** (token ops) |
| Routes | `/api/integrations/oauth/[providerKey]/connect|callback` |
| Services | `oauth-authorization-service.ts`, `oauth-callback-service.ts` |
| Security | PKCE, HMAC state, AES encryption — **implemented** |
| Gap | `exchangeAuthorizationCode` returns mock tokens |

## 17. Credentials

| Status | **FUNCTIONAL BUT INCOMPLETE** |
| Vault | `credential-vault.ts` (AES-256-GCM) |
| Rotation/refresh | `credential-rotation-service.ts`, `credential-refresh-service.ts` |
| Models | `ProviderCredential` |
| Gap | Refresh calls mock OAuth adapter |

## 18. Marketing Data Sync

| Status | **MOCK ONLY** |
| Migration | `20260805230000_stage_13_marketing_data_sync` |
| Adapters | `mock-sync-adapter.ts` for all sync keys |
| API | `/api/integrations/[connectionId]/sync/**` |
| Tests | `provider-sync-foundation.test.ts` |

## 19. Analytics

| Status | **PARTIAL** |
| UI | `/analytics/**`, `/data`, executive dashboards |
| Models | Stage 7 canonical: `AnalyticsFact`, `AnalyticsDataSource`, etc. |
| Warehouse | `marketing-warehouse-*` services |
| Gap | Live ingestion depends on connectors + schedulers |

## 20. Reporting

| Status | **PARTIAL** |
| UI | `/reports`, social reports |
| API | `/api/reports/**`, shared token reports |
| Gap | Shared reports are public token-based (security review) |

## 21. AI Agents

| Status | **PARTIAL** |
| UI | `/agents` (basic); nav `comingSoon` |
| API | `/api/agents/**` |
| Services | `agent-platform-service.ts` |
| Gap | Actions not executed; MOCK LLM default |

## 22. AI Tools

| Status | **PARTIAL** |
| Implementation | Agent tool executor reads DB (campaigns, facts, content, leads) |
| Permissions | `ai.tools.read`, `ai.agent.*` |
| Gap | No standalone tools UI |

## 23. Automation Engine

| Status | **PARTIAL** |
| UI | `/automation-engine/**` (demo-level) |
| API | `/api/brands/[brandId]/automation-engine` |
| Services | `automation-engine-service.ts`, `automation-engine-execution-service.ts` |
| Gap | No event emitters; schedule triggers not executed |

## 24. Approvals

| Status | **FUNCTIONAL BUT INCOMPLETE** |
| UI | `/approvals` |
| API | Brand-scoped approval routes |
| Permissions | `approvals.read`, `approvals.decide` |
| Models | Multiple approval types across domains |

## 25. Tasks / Marketing Operations

| Status | **FUNCTIONAL BUT INCOMPLETE** |
| UI | `/tasks/**`, `/operations` |
| API | `/api/brands/[brandId]/tasks/**`, marketing tasks |
| Migration | `20260805180000_marketing_operations_tasks_approvals` |
| Tests | Operations unit tests |

## 26. Notifications

| Status | **FUNCTIONAL BUT INCOMPLETE** |
| UI | `/notifications` |
| API | `/api/notifications/**` |
| Email | Resend integration |
| Digest worker | External trigger required |

## 27. Collaboration

| Status | **FUNCTIONAL BUT INCOMPLETE** |
| UI | Comments, inbox |
| API | `/api/comments/**`, `/api/inbox/**` |
| Migration | `20260805240000_notifications_inbox_collaboration` |
| Tests | `collaboration-platform` e2e |

## 28. Integrations

| Status | **PARTIAL** |
| UI | `/integrations`, `/connectors` |
| APIs | Stage 11 + Stage 12 + legacy connectors |
| Gap | Parallel stacks; most providers disabled |

## 29. Organisation / Workspace

| Status | **COMPLETE** (core flows) |
| UI | `/settings/**`, onboarding |
| API | `/api/organisations`, `/api/projects`, `/api/workspace` |
| Auth | Supabase + session management |
| Tests | `workspace.spec.ts`, onboarding tests |

## 30. Users / Members

| Status | **FUNCTIONAL BUT INCOMPLETE** |
| API | `/api/members`, `/api/invitations` |
| Permissions | `members.*` |
| Rules | OWNER-only for owner management |

## 31. Roles / Permissions

| Status | **FUNCTIONAL BUT INCOMPLETE** |
| Roles | OWNER, ADMIN, MARKETER, ANALYST, VIEWER |
| Permissions | 318 defined |
| Gap | `requirePermission()` unused; some routes membership-only |

## 32. Settings

| Status | **FUNCTIONAL BUT INCOMPLETE** |
| UI | `/settings/security`, sessions, projects, billing |
| API | Various settings routes |

## 33. Audit Logs

| Status | **FUNCTIONAL BUT INCOMPLETE** |
| API | `/api/audit-log` |
| Models | `AuditLog`, `SecurityAuditLog` |
| Permissions | `auditLogs.read` (ADMIN/ANALYST) |

## 34. Admin / Operational Tooling

| Status | **SCAFFOLD** |
| Routes | `/api/admin/diagnostics/auth-database` |
| UI | `/operations/**` (publishing recovery, tasks) |
| Gap | Limited admin centre; Stage 17 branch may extend |

---

## Additional modules discovered

| Module | Status | Key paths |
|--------|--------|-----------|
| CRM | FUNCTIONAL BUT INCOMPLETE | `/crm/**`, extensive services |
| SEO | FUNCTIONAL BUT INCOMPLETE | `/seo/**`, crawler, keywords |
| Email campaigns | FUNCTIONAL BUT INCOMPLETE | `/email/**` |
| Marketing Automation (journeys) | FUNCTIONAL BUT INCOMPLETE | `/automation/**` |
| Visual Studio | PARTIAL (mock images) | `/visual-studio/**` |
| Forms / Leads | FUNCTIONAL BUT INCOMPLETE | `/forms`, `/leads` |
| Billing / Entitlements | SCAFFOLD | Stage 16 models; Stripe provider |
| Tracking / First-party analytics | PARTIAL | `/api/tracking/**` |
| Growth / Experiments | PARTIAL | `/growth`, `/experiments` |
| Data warehouse | PARTIAL | `/data`, warehouse services |
| Compliance agent | FUNCTIONAL | Rule-based + optional AI |
| Lifecycle agent | FUNCTIONAL | Rule-based CRM assistant |

---

## Summary counts by status

| Status | Count (of 34+ modules) |
|--------|------------------------|
| COMPLETE | 1 |
| FUNCTIONAL BUT INCOMPLETE | 18 |
| PARTIAL | 12 |
| SCAFFOLD | 3 |
| MOCK ONLY | 3 (OAuth tokens, sync, publication gateway) |
| DISCONNECTED | 2 |
| NOT IMPLEMENTED | 0 (modules exist; gaps are sub-features) |
