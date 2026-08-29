# Task 10.1 Release Candidate

**Version:** v1.0.0-rc.1

## Integrated base

This release candidate integrates:

| Task | PR | Branch |
| ---- | -- | ------ |
| Task 3 — Content Intelligence | #147 | `cursor/content-intelligence-engine-3-d3f8` |
| Task 3.1 — AI Content Brief | #148 | `cursor/task-3-1-ai-content-production-6bdf` |
| Task 4 — Provider Connections | #150 | `cursor/task-4-production-provider-connections-d3f8` |
| Task 5 — Unified Analytics | #149 | `cursor/task-5-unified-analytics-attribution` |
| Task 6 — Automations & Background Ops | #151 | `cursor/task-6-automations-scheduler-7a66` |
| Task 7 — Onboarding & Activation | #154 | `cursor/task-7-onboarding-activation-7a66` |
| Task 8 — Billing & Entitlements | #153 | `cursor/task-8-billing-entitlements-d3f8` |
| Task 9 — Security & Reliability | #152 | `cursor/task-9-production-security-reliability-6bdf` |
| Task 10 — Launch Preparation | #155 | `cursor/task-10-final-launch-preparation-6bdf` |

## CI gates (post-rebase)

| Check | Status |
| ----- | ------ |
| lint | Pass (warnings only) |
| typecheck | Pass (tests excluded from graph) |
| unit | 1879 passed |
| integration | 478 passed |
| production build | Pass |
| Prisma validation | Pass |
| migration validation | Pass (88 migrations) |
| launch E2E | 26+ passed (auth screenshots skipped without ALLOW_TEST_AUTH) |

## External verification still required

- Stripe live configuration (products, prices, webhooks, portal)
- OAuth provider production approvals
- Production scheduler heartbeat
- DNS / HTTPS / email domain
- Legal external review (pages no longer placeholders)
- Production-candidate smoke test on deployed environment
- Cross-browser manual matrix (Chrome automated; Edge/Safari/Firefox manual)
