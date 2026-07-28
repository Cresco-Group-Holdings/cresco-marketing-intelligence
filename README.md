<<<<<<< HEAD
# cresco-marketing-intelligence
AI-powered marketing intelligence platform for content generation, campaign automation, SEO, social media publishing, lead generation, analytics, and CRM integration.
=======
# Cresco Marketing Intelligence

AI Marketing & Growth Platform for planning, creating, publishing, measuring, and optimising marketing campaigns across websites, search engines, email, advertising platforms, and social media.

## Status

Task 1.1 delivers the platform foundation:

- Next.js App Router application shell
- Supabase authentication integration points
- PostgreSQL + Prisma data foundation
- Tenant isolation baseline
- Dashboard layout and placeholder modules
- CI, tests, and documentation

Integrations, publishing, analytics pipelines, and AI workflows are intentionally not implemented yet.

## Quick start

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run dev
```

See `docs/DEVELOPMENT.md` for full setup instructions.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Environment](docs/ENVIRONMENT.md)
- [Development](docs/DEVELOPMENT.md)
- [Security baseline](docs/SECURITY_BASELINE.md)

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run Playwright smoke tests |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript strict check |
| `npm run audit:deps` | Dependency audit |
| `npm run audit:secrets` | Secret pattern scan |

## Internal use cases

The platform is being built to support:

1. Cresco Grants Intelligence
2. Capital Cresco Terminal
3. Cresco Group

## License

Proprietary — Cresco Group.
>>>>>>> 5a905a3 (feat: establish Cresco Marketing Intelligence platform foundation)
