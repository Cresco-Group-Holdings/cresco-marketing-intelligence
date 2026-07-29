# AI Social Content Studio

The studio produces editable, platform-specific content drafts for Instagram, TikTok, LinkedIn, Facebook, YouTube, and X. It does not publish content or create media.

## Safety and source material

- Imported article and repurposed content requires user-supplied or approved retrieved text. The application does not fetch or scrape arbitrary URLs.
- Imported text is checked for prompt-injection patterns before it reaches an AI provider.
- Structured responses are validated before being saved.
- Safety scans flag guarantees, fabricated grants or results, fake testimonials, impersonation, and discriminatory language for manual review.

## Governance

The generation service selects only requested audience, persona, offer, messaging, voice, compliance, and objective records. Used records, AI provider, model, prompt template version, estimated cost, and platform-rule version are saved in content provenance.

All AI output remains in `AI_GENERATED` state. Users may edit, compare platform variants, restore revisions, and submit drafts through the existing review workflow.
