# Stage 2 publishing checkpoint

Validated on 2026-07-29 using mocked official-provider responses and the production adapters.

1. AI Content Studio creates controlled, brand-aware structured content.
2. Platform variants are saved independently for Instagram, TikTok, LinkedIn, Facebook, YouTube, and X.
3. Visual Studio and Video Studio create licensed media and attach it to the relevant `ContentVariant`.
4. Content enters the approval workflow and cannot publish from an AI-generated or draft state.
5. An authorised approver moves content to `APPROVED`.
6. The scheduling engine validates the connected account, UTC time, assets, licence expiry, and variant state before creating a durable schedule.
7. The publishing worker dispatches the durable job to the official provider adapter.
8. Provider processing, quota, permission, policy, media, and token failures produce actionable persisted attempts; unavailable commercial/API access produces an explicit manual package.
9. Successful jobs store provider post IDs and public URLs. Manual publication requires explicit URL confirmation.
10. Job idempotency keys, persisted upload/container state, partial-thread state, and unique provider post IDs prevent duplicate publishing.

Automated coverage spans adapter payloads, uploads, processing reconciliation, threads, partial failure recovery, tenant isolation, quota fallback, token refresh, and idempotency. Real provider sandbox checks remain environment-dependent and require approved provider apps and credentials.
