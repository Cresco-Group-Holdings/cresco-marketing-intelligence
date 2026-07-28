# Deployment Guide (Vercel)

Stage 1 is designed for Vercel deployment with external PostgreSQL and Supabase Auth.

## Prerequisites

- Vercel account linked to GitHub repository
- Production PostgreSQL database (Supabase, Neon, or RDS)
- Supabase project for authentication
- Object storage for marketing assets (Supabase Storage recommended)

## Environment variables

Configure in Vercel → Project → Settings → Environment Variables.

| Variable | Development | Preview | Production |
|----------|-------------|---------|------------|
| `DATABASE_URL` | Local/preview DB | Preview DB (pooled) | Production DB (pooled) |
| `DIRECT_URL` | Direct connection | Preview direct | Production direct |
| `NEXT_PUBLIC_SUPABASE_URL` | Dev project | Preview project | Production project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dev anon key | Preview anon key | Production anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Dev service key | Preview service key | Production service key |
| `APP_URL` | `http://localhost:3000` | Preview URL | Production domain |
| `ENCRYPTION_KEY` | Local key | Unique preview key | Unique production key |
| `SUPABASE_MARKETING_ASSETS_BUCKET` | Dev bucket | Preview bucket | Production bucket |

Optional: AI provider keys, OAuth integration keys (see `docs/ENVIRONMENT.md`).

**Never set in production:**
- `ALLOW_TEST_AUTH=true`
- `ALLOW_DEV_SEED=true`

## Build configuration

Default Next.js build:

```bash
npm run build
```

Vercel automatically runs `postinstall` → `prisma generate`.

## Database migrations

Migrations are **not** run automatically by Vercel build.

### Preview

```bash
DATABASE_URL="<preview-direct-url>" npm run db:migrate:deploy
```

### Production

```bash
DATABASE_URL="<production-direct-url>" npm run db:migrate:deploy
```

Run migrations before or immediately after promoting a deployment.

## Auth callback URLs

Configure in Supabase → Authentication → URL Configuration:

| Environment | Site URL | Redirect URLs |
|-------------|----------|---------------|
| Development | `http://localhost:3000` | `http://localhost:3000/auth/callback` |
| Preview | `https://<branch>-<project>.vercel.app` | `https://<branch>-<project>.vercel.app/auth/callback` |
| Production | `https://<your-domain>` | `https://<your-domain>/auth/callback` |

## Preview deployments

- Every PR creates a preview deployment
- Use isolated preview database and Supabase project where possible
- Set `APP_URL` to the preview deployment URL
- Safe for internal QA — do not use production credentials

## Production deployment

1. Merge to `main` does **not** auto-deploy to production unless configured.
2. Recommended: require manual promotion in Vercel.
3. Follow `docs/STAGE_1_RELEASE_CHECKLIST.md`.

## Health checks

Configure Vercel or external monitor:

- Liveness: `GET /api/health`
- Readiness: `GET /api/readiness`

## Content Security Policy

CSP is applied via middleware (`src/lib/security/headers.ts`). Verify no violations on:
- Login/signup
- Dashboard
- Supabase auth redirects

## Rollback

See `docs/ROLLBACK.md` — promote previous Vercel deployment.

## Do not

- Deploy to production automatically without explicit authorisation
- Share encryption keys between environments
- Use production database for preview deployments
