# AI Architecture

Task 1.7 introduces a provider-independent AI core for future content, SEO, analytics, and sales agents.

## Design principles

- Provider SDKs and API keys stay server-side only
- UI components and route handlers call `AIRequestService`, never providers directly
- Prompt templates are versioned and stored in the database
- Brand knowledge is injected through a controlled context builder
- Usage, latency, and estimated cost are recorded per request

## Core components

| Component | Responsibility |
| --- | --- |
| `AIProvider` | Provider interface for text and structured generation |
| `AIModelRegistry` | Model metadata, capabilities, limits, and cost data |
| `AIRequestService` | Orchestrates validation, execution, retries, and persistence |
| `AIResponseParser` | Parses text and validates structured JSON with Zod |
| `AIUsageRecorder` | Persists token usage and estimated cost |
| `AIErrorMapper` | Maps provider failures to application errors |

## Providers

Supported providers:

- OpenAI
- Anthropic
- Google Gemini
- Mock (default fallback for development and tests)

Provider selection resolves to the first configured provider in priority order, otherwise falls back to `MOCK`.

## Data model

- `AIRequest` — tenant-scoped request record with purpose, status, usage, and digests
- `AIExecution` — per-attempt execution details, including structured output when applicable
- `AIUsageRecord` — usage ledger for cost controls and dashboards
- `PromptTemplate` / `PromptTemplateVersion` — versioned server-side prompt governance

Raw confidential prompts are not stored by default. The service stores SHA-256 digests and short redacted previews only.

## Extension points

The model registry includes capability placeholders for:

- image generation
- audio generation
- video generation
- embeddings

Only text generation and structured output are implemented in Task 1.7.

## API surface

| Route | Purpose |
| --- | --- |
| `GET /api/ai/diagnostics` | Provider and model configuration check |
| `POST /api/ai/diagnostics` | Harmless diagnostics execution |
| `GET /api/ai/usage` | Organisation usage dashboard foundation |

## UI

Administrator/development diagnostics page:

`/settings/ai-diagnostics`

This page is disabled in production unless `ALLOW_AI_DIAGNOSTICS=true`.
