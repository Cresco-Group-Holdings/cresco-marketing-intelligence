# AI Privacy

The AI core is designed to minimise exposure of sensitive tenant and user data.

## Data minimisation

By default the platform stores:

- SHA-256 digests of redacted input and output
- short redacted previews (up to 500 characters)
- token usage and estimated cost metadata

It does **not** store unrestricted confidential prompts or full provider responses by default.

## Redaction

`SensitiveDataRedactor` removes common secret patterns before requests are sent to providers, including:

- bearer tokens and JWTs
- API keys (`sk_`, `pk_`, `AIza...`)
- `password=`, `api_key=`, `secret=`, and `cookie=` style assignments

## Prohibited outbound data

The following must never be sent to AI providers:

- raw OAuth tokens
- session cookies
- database credentials
- private provider keys
- user-supplied secrets pasted into prompts

## Tenant isolation

All AI requests are scoped by `organisationId` and validated against the active tenant context before execution.

## Diagnostics restrictions

The diagnostics endpoint and page are restricted to administrators and are disabled in production unless explicitly enabled with `ALLOW_AI_DIAGNOSTICS=true`.

## Future agents

Downstream content, SEO, analytics, and sales agents must reuse `AIRequestService` rather than implementing direct provider access.
