# Environment configuration

Cresco Marketing Intelligence uses typed environment validation in `src/lib/environment/index.ts`. Missing required values produce clear startup errors.

## Required variables

| Variable | Exposure | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Server only | Prisma connection string |
| `DIRECT_URL` | Server only | Direct PostgreSQL connection for migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Privileged Supabase operations |
| `APP_URL` | Server only | Canonical application URL |
| `ENCRYPTION_KEY` | Server only | Application-level encryption (min 32 chars) |

## Optional integration variables

These may be omitted during local development. The environment module reports whether each integration is configured.

| Variable | Exposure | Integration |
| --- | --- | --- |
| `OPENAI_API_KEY` | Server only | OpenAI |
| `ANTHROPIC_API_KEY` | Server only | Anthropic |
| `GOOGLE_CLIENT_ID` | Server only | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Server only | Google OAuth |
| `META_APP_ID` | Server only | Meta OAuth |
| `META_APP_SECRET` | Server only | Meta OAuth |
| `TIKTOK_CLIENT_KEY` | Server only | TikTok OAuth |
| `TIKTOK_CLIENT_SECRET` | Server only | TikTok OAuth |
| `LINKEDIN_CLIENT_ID` | Server only | LinkedIn OAuth |
| `LINKEDIN_CLIENT_SECRET` | Server only | LinkedIn OAuth |

Only `NEXT_PUBLIC_*` variables may be exposed to the browser.

## Local development

1. Copy `.env.example` to `.env`.
2. Fill in database and Supabase credentials.
3. Generate a 32+ character `ENCRYPTION_KEY`.
4. Run `npm install`.
5. Run `npm run db:migrate`.
6. Start the app with `npm run dev`.

Integration keys can remain blank while working on UI and tenant foundations.

## Vercel configuration

Configure the same variables in the Vercel project settings:

- Add server-only values as encrypted environment variables.
- Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Production, Preview, and Development as needed.
- Set `APP_URL` to the deployed canonical URL for each environment.
- Use separate Supabase projects or keys per environment where possible.

Never add service role keys, AI provider keys, OAuth secrets, encryption keys, or database credentials to `NEXT_PUBLIC_*` variables.

## Validation behaviour

- Required values throw descriptive errors during startup or first access.
- Optional integrations return `configured: false` in status responses.
- Tests can reset the environment cache via `resetEnvCacheForTests()`.
