# Development guide

## Prerequisites

- Node.js 22+
- PostgreSQL 14+
- npm 10+
- Supabase project (for authentication)

## Installation

```bash
git clone https://github.com/Cresco-Group-Holdings/cresco-marketing-intelligence.git
cd cresco-marketing-intelligence
npm install
cp .env.example .env
```

Update `.env` with your local credentials.

## Database setup

Create a local database:

```sql
CREATE DATABASE cresco_marketing;
```

Run migrations:

```bash
npm run db:migrate
```

Generate the Prisma client after schema changes:

```bash
npm run db:generate
```

Open Prisma Studio:

```bash
npm run db:studio
```

## Running the application

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

## Testing

Unit and integration tests:

```bash
npm run test
npm run test:watch
```

Playwright smoke tests:

```bash
npm run test:e2e
```

## Quality checks

```bash
npm run lint
npm run typecheck
npm run format:check
npm run build
npm run audit:deps
npm run audit:secrets
```

## Production build

```bash
npm run build
npm run start
```

Ensure all required environment variables are configured in the deployment environment before starting the production server.

## Branch workflow

1. Create a feature branch from `main`.
2. Implement changes with tests and documentation updates.
3. Open a pull request.
4. Ensure CI passes: lint, typecheck, unit tests, build, dependency audit, and secret scan.
5. Request review before merge.

Playwright smoke tests run via a separate manual or scheduled workflow.

## Marketing data warehouse (Task 3.1)

Enable the warehouse locally:

```bash
# .env
MARKETING_WAREHOUSE_ENABLED=true
MARKETING_WAREHOUSE_INLINE_PROCESSING=true
MARKETING_WAREHOUSE_WORKER_TOKEN=dev-warehouse-token
```

Apply the warehouse migration (included in standard migrate):

```bash
npm run db:migrate
```

The migration `20260730100000_task_3_1_marketing_data_warehouse` adds ~50 Prisma models. Regenerate the client after applying:

```bash
npm run db:generate
```

### Local workflow

1. Start the dev server: `npm run dev`
2. Open `/analytics/marketing-data` (requires `MARKETING_WAREHOUSE_ENABLED=true`)
3. Upload a CSV via the manual import UI or API (`docs/MANUAL_IMPORT.md`)
4. With `MARKETING_WAREHOUSE_INLINE_PROCESSING=true`, batches process synchronously in the request — no separate worker needed
5. Inspect results in Prisma Studio: `npm run db:studio` → `MarketingMetricObservation`, `RawMarketingBatch`

### Triggering a worker pass manually

When inline processing is disabled, call the worker endpoint:

```bash
curl -X POST http://localhost:3000/api/marketing-data/batches/process-due \
  -H "Authorization: Bearer dev-warehouse-token"
```

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `MARKETING_WAREHOUSE_ENABLED` | `false` | Enable warehouse routes and UI |
| `MARKETING_WAREHOUSE_INLINE_PROCESSING` | `false` | Process batches inline (dev/test only) |
| `MARKETING_WAREHOUSE_WORKER_TOKEN` | — | Worker bearer token |
| `MARKETING_WAREHOUSE_MAX_BATCH_SIZE` | `1000` | Records per batch pass |
| `MARKETING_WAREHOUSE_MAX_IMPORT_BYTES` | `10485760` | Max upload size (10 MB) |
| `MARKETING_WAREHOUSE_LEASE_SECONDS` | `300` | Worker lease duration |

No live GA4 or Google Ads credentials are required for 3.1 development. Use manual import or test fixtures.

### Tests

Warehouse unit and integration tests run with the standard suites:

```bash
npm run test
```

Database tests (when `ANALYTICS_TEST_DATABASE_URL` is set) exercise real warehouse services with mocked object storage.

See `docs/MARKETING_DATA_WAREHOUSE.md` and `docs/WAREHOUSE_OPERATIONS.md` for architecture and operations detail.

## Project structure

See `docs/ARCHITECTURE.md` for layer boundaries and tenant context rules.
