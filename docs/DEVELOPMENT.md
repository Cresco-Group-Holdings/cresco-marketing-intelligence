# Development guide

## Prerequisites

- Node.js 22+
- PostgreSQL 14+
- npm 10+
- Supabase project (for authentication)

## Installation

```bash
git clone https://github.com/romanpavlenkolondon-glitch/cresco-marketing-intelligence.git
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

## Project structure

See `docs/ARCHITECTURE.md` for layer boundaries and tenant context rules.
