# Brand profile

The Brand Profile is a structured, tenant-scoped knowledge record attached one-to-one to each brand.

## Purpose

Brand profiles capture positioning, audience, offer, voice, market context, and compliance notes. In later tasks this data will feed:

- AI Content Studio
- AI Reel Generator
- SEO Agent
- Social Media Agent
- AI Sales Agent

Task 1.2 does **not** connect any AI providers. Profiles are stored and edited deterministically.

## Sections

1. **Overview** — short description, long description, mission, value proposition
2. **Audience** — target audience, customer problems, target countries, target industries
3. **Offer** — products and services, key benefits
4. **Voice** — preferred tone, prohibited tone, preferred language
5. **Market** — competitors
6. **Governance** — compliance notes

## Completeness indicator

Completeness is calculated from populated structured fields only. It does not generate content or claim AI readiness.

Essential onboarding fields:

- short description
- target audience
- value proposition

## API

- `GET /api/brands/:brandId/profile`
- `PUT /api/brands/:brandId/profile`

Both require organisation tenant context and appropriate RBAC permissions.
