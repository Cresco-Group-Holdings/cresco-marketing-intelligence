# Provider Publishing Adapters

## Contract

Platform adapters implement `PlatformProviderAdapter` from `platform-adapter.ts`.

Publishing operations:

| Operation | Description |
|-----------|-------------|
| `publishPost` | Immediate publish |
| `schedulePost` | Schedule for future (if supported) |
| `getPublicationStatus` | Poll status |
| `cancelScheduledPost` | Cancel scheduled post |

## Normalized result

```typescript
{
  success: boolean;
  data?: {
    externalPublicationId: string;
    permalink?: string;
    status: string;
    providerTimestamp?: string;
    duplicate?: boolean;
  };
  errorCode?: string;
  errorMessageSafe?: string;
  retryable?: boolean;
}
```

## Production adapters

| Provider | Adapter | Capability |
|----------|---------|------------|
| `meta` / `meta-ads` | `meta-social-publishing-adapter.ts` | Instagram via Graph API |

## Token acquisition

Adapters receive `context.getAccessToken()` from `providerGateway`, which calls Task 1 `tokenLifecycleService`. Adapters must not call OAuth or read credentials directly.

## Capability validation

`providerSupportsCapability("meta", "SOCIAL_CONTENT_PUBLISH")` must be true for publishing.

Content validation (caption length, media required) occurs in `publicationService.create()` via `adaptContentForProvider()`.

## Mock adapters

`mock-social` is for tests only. Production runtime throws if mock is resolved for a production provider.
