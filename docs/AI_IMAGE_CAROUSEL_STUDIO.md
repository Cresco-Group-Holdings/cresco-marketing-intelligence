# AI Image and Carousel Studio

Visual Studio creates brand-controlled image and carousel drafts. It supports social post formats, cover graphics, quote cards, and simple infographics.

## Governance

- Projects use versioned templates, pages, elements, and exports.
- Brand colours, logo position, footer, disclaimers, and safe margins may be locked.
- Image generation is behind a provider abstraction. The current deployment uses the deterministic mock provider; provider credentials are never exposed to clients.
- Source assets must be ready, approved, unexpired, and have consent notes before image generation can reference them.
- Every generation records provider, model, prompt version, source asset, moderation, commercial-use metadata, and estimated cost.

## Exports and accessibility

PNG, JPG, WebP, PDF, and ZIP exports are stored as secure Marketing Assets. Image exports may be attached to an approved ContentVariant. Export validation reports text-size and overflow warnings, and accepts editable alt text.
