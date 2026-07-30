# On-Page SEO AI Review

AI semantic review supplements deterministic checks. Schema key: `onPage.semantic.review`

## Review dimensions

- Intent alignment
- Topic completeness
- Entity coverage
- Question coverage (from SEO brief)
- Content clarity
- Audience fit (from brand knowledge)
- Factual support
- Differentiation
- CTA relevance

## Evidence requirement

**Every AI finding must include evidence references.** The AI must not fabricate statistics or cite sources not present in the input bundle.

## Input bundle

- Page metadata (title, description, headings, word count)
- Target keyword and brief questions
- Body text excerpt (up to 4000 chars)
- Brand context from knowledge base
- Crawl snapshot / draft provenance

## Output

Structured JSON with:
- `findings[]` — categorised findings with evidence
- `intentAlignment` — score 0–1 with evidence
- `topicCompleteness` — covered/missing topics with evidence
- `limitations[]` — data gaps
- `disclaimer` — no ranking guarantees

## Safeguards

- Does not recommend keyword stuffing
- Does not claim rankings will improve
- Skipped gracefully if AI unavailable (audit still completes with deterministic checks)
- No automatic production changes

## Template

Prompt template key: `onPage.semantic.review` in `prompt-template-service.ts`.
