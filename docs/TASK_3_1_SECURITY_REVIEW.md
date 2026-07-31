# Task 3.1 Security Review

Date: 2026-07-30  
Branch: `cursor/marketing-data-warehouse-e94c`

Security review for the Unified Marketing Data Warehouse (Task 3.1): schema, ingestion framework, manual import, stub normaliser, query services, and operations APIs.

## Threats reviewed

| Threat | Review outcome |
| --- | --- |
| Cross-tenant data access | Mitigated — all warehouse models include `organisationId`/`projectId`/`brandId`; services assert tenant scope before reads and mutations |
| IDOR on batch/import/record IDs | Mitigated — brand-scoped routes validate membership; record lookups filter by tenant keys |
| Raw payload exfiltration | Mitigated — `marketingData.viewRaw` permission restricted to OWNER/ADMIN; raw routes excluded from standard read responses |
| PII in event/identity data | Partially mitigated — schema supports EMAIL/PHONE identities; import validation rejects known secret patterns; logging redaction applies |
| Manual import file attacks | Mitigated — size limits, format validation, no server-side execution of uploaded content; storage path not user-controlled |
| Worker endpoint abuse | Mitigated — bearer token auth via `worker-auth.ts`; tokens server-only |
| Privilege escalation via warehouse permissions | Mitigated — `marketingData.*` permissions added to central matrix; MARKETER/VIEWER roles restricted |
| Mass assignment on import mappings | Mitigated — Zod schemas whitelist mapping fields; `targetField` validated against `MarketingDataSourceField` catalogue |
| Secrets in raw payloads | Mitigated — normaliser rejects payloads matching credential patterns; documentation prohibits credential storage in raw layer |
| SQL injection via JSON filters | Mitigated — Prisma parameterised queries; no raw SQL on user-supplied JSON paths in 3.1 |
| Reprocess data corruption | Mitigated — idempotency keys prevent duplicate facts; lineage append-only; reprocess requires `marketingData.sync` |
| FX rate manipulation | Mitigated — rate changes require `marketingData.manage`; audit logged |
| Feature flag bypass | Mitigated — `MARKETING_WAREHOUSE_ENABLED` checked server-side on all routes and workers |
| Denial of service via large imports | Partially mitigated — file size and batch size limits; production should add rate limiting on import endpoints (deferred) |

## Controls implemented

### Permissions

New `marketingData.*` permissions in `src/lib/tenancy/permissions.ts`:

| Permission | OWNER | ADMIN | MARKETER | ANALYST | VIEWER |
| --- | --- | --- | --- | --- | --- |
| `marketingData.read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `marketingData.import` | ✓ | ✓ | ✓ | | |
| `marketingData.sync` | ✓ | ✓ | | | |
| `marketingData.manage` | ✓ | ✓ | | | |
| `marketingData.viewRaw` | ✓ | ✓ | | | |
| `marketingData.admin` | ✓ | | | | |

Enforced via `withApiHandler` on all warehouse API routes.

### Tenant isolation

- All warehouse Prisma models tenant-scoped (except global registry)
- Repositories call `assertOrganisationScope` / `assertBrandScope`
- `MarketingDataSourceAccount` unique per `[brandId, marketingDataSourceId, externalAccountId]`
- Cross-brand queries impossible without membership in both brands

### Raw data access

- `inlinePayload` and upload files served only through `/raw/[recordId]` with `marketingData.viewRaw`
- Standard metric/event queries return normalised facts only
- Log statements never include raw payload content

### Encryption

- Connector credentials remain in `ConnectorCredential` (encrypted via `src/lib/security/encryption.ts`)
- Raw marketing payloads are **not** encrypted at rest in 3.1 (no secrets expected per design)
- Large payloads offloaded to object storage with brand-scoped paths

### Audit logging

Warehouse mutations recorded via `recordAuditEvent()`:

- Import create/upload/process
- Batch trigger/reprocess/cancel
- Quality issue resolution
- Currency rate creation
- Identity link confirmation

### Worker authentication

- `MARKETING_WAREHOUSE_WORKER_TOKEN` required for batch/aggregate/health worker routes
- Same constant-time comparison as existing worker auth
- Tokens never exposed in API responses or client bundles

### Input validation

- Zod schemas for import payloads, mapping config, event ingestion, currency rates
- `observed_at` / `occurred_at` validated as ISO 8601
- Currency codes validated as ISO 4217
- File format enum enforced on upload

## Residual risks

| Risk | Severity | Mitigation plan |
| --- | --- | --- |
| No rate limiting on import upload | Medium | Edge rate limiting in 3.2; size limits adequate for 3.1 |
| PII in manual import files | Medium | Brand data policy; future PII detection rules |
| Object storage path traversal | Low | Server-generated paths only; no user-supplied paths |
| In-memory rate limiter not distributed | Low | Existing platform limitation; adequate for preview |
| Identity graph without probabilistic resolution | Low | Explicit links only in 3.1; documented limitation |
| No encryption at rest for raw payloads | Low | Payloads must not contain secrets by policy |
| Stub normaliser accepts test fixtures in dev | Low | `provider_not_active` rejection in production for GA4/Ads |

## Out of scope (accepted)

1. Live GA4/Ads/Meta connector ingest — no OAuth token flow to warehouse in 3.1
2. Automated PII scanning on import files
3. Field-level encryption for event properties
4. Row-level security policies in PostgreSQL (application-layer enforcement only)
5. SOC2 control mapping for warehouse
6. Penetration testing of warehouse endpoints

## Deferred to Task 3.2+

- Encrypted raw payload storage option
- Import endpoint rate limiting
- Automated freshness alert notifications
- Connector OAuth → warehouse credential binding security review
- Social ETL write-path security (when social data migrates to warehouse ingest)

## Sign-off

Warehouse schema, permissions, manual import, stub normaliser, and operations APIs meet Task 3.1 security requirements. Live provider integrations require a separate security review when adapters ship in 3.2.

## Related documentation

- `docs/SECURITY_BASELINE.md` — platform security baseline
- `docs/MARKETING_DATA_WAREHOUSE.md` — architecture
- `docs/MANUAL_IMPORT.md` — import security controls
- `docs/TASK_3_1_PREFLIGHT.md` — pre-flight decisions
