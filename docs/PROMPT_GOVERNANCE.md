# Prompt Governance

Prompt governance ensures AI instructions remain server-controlled, auditable, and separated from user input.

## Versioned templates

Prompts are stored as `PromptTemplate` records with immutable `PromptTemplateVersion` rows.

Each template includes:

- stable `key` (for example `diagnostics.ping`)
- purpose (`AIPurpose`)
- active version pointer
- system instructions
- optional output schema key

## Separation of concerns

`AIRequestService` constructs messages in this order:

1. **System prompt** from the active template version
2. **Brand context** from the controlled knowledge-base builder (optional)
3. **User input** as a separate user message

User input is never merged into the system prompt.

## Prompt injection baseline

The service rejects user input that matches known instruction-override patterns, such as:

- "ignore previous instructions"
- "reveal the system prompt"
- "you are now ..."

## Structured output validation

Structured responses are validated with Zod schemas registered in `AIRequestService`.

Invalid provider output is rejected and recorded as a failed execution.

## Auditability

Each prompt version records:

- version number
- status (`DRAFT`, `ACTIVE`, `ARCHIVED`)
- creator (`createdByUserId`)
- creation timestamp

Template changes do not mutate historical versions.

## Secrets policy

Secrets, API keys, OAuth tokens, cookies, and credentials must never be placed in prompt templates or user-visible instructions.

The redaction layer also strips common secret patterns from outbound text.
