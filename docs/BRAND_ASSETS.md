# Brand Asset Library

Task 1.6 adds a secure marketing asset library for uploading, organising, and reusing approved brand assets.

## Storage

Assets are stored in private object storage via a provider abstraction:

- Default provider: Supabase Storage (`SupabaseObjectStorageProvider`)
- Test/local fallback: in-memory provider when `MARKETING_ASSET_STORAGE_PROVIDER=memory`

Environment:

- `SUPABASE_MARKETING_ASSETS_BUCKET` (optional, default `marketing-assets`)

Storage keys are tenant-safe and non-sequential:

`{organisationId}/{brandId}/{assetId}/{filename}`

## Supported file types

| Category | Extensions | MIME types |
| --- | --- | --- |
| Image | `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg` | `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml` |
| Video | `.mp4`, `.mov` | `video/mp4`, `video/quicktime` |
| Audio | `.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg` | `audio/mpeg`, `audio/wav`, `audio/mp4`, `audio/aac`, `audio/ogg`, `audio/x-wav` |
| Document | `.pdf` | `application/pdf` |

Executable and script file types are blocked.

## Security controls

- Private storage by default
- Signed access URLs with short TTL (300 seconds)
- Server-side MIME sniffing via `file-type`
- Extension allowlists per asset category
- Upload size limits per category
- SVG sanitisation before storage
- Raster image re-encoding via `sharp` to strip metadata where practical
- Malware scan abstraction (`NoOpMalwareScanner` by default)
- No trust in browser-supplied MIME types

## Data model

`MarketingAsset` fields include:

- file metadata: `filename`, `originalFilename`, `storageKey`, `mimeType`, `sizeBytes`, `width`, `height`, `durationSeconds`
- organisation fields: `assetType`, `title`, `description`, `tags`, `status`
- governance: `approvedForMarketing`, `approvedPlatforms`, `licenceOwner`, `licenceNotes`, `licenceExpiresAt`, `attributionRequired`, `consentNotes`
- ownership: `uploadedByUserId`

Statuses:

- `PROCESSING`
- `READY`
- `REJECTED`
- `ARCHIVED`

## API

Base path: `/api/brands/[brandId]/marketing-assets`

| Route | Methods | Permission |
| --- | --- | --- |
| `/` | GET | `marketingAssets.read` |
| `/upload` | POST (multipart) | `marketingAssets.update` |
| `/[assetId]` | GET, PUT, DELETE | read / update |
| `/[assetId]/signed-url` | GET | `marketingAssets.read` |

## UI

Dashboard route: `/brands/[brandId]/assets`

Features:

- grid and list views
- upload flow
- preview via signed URLs
- filters by type, tag, and approval status
- governance editing in asset detail panel
- archive action

## Relationship to BrandAsset

Task 1.5 `BrandAsset` records remain metadata references inside the brand knowledge base. Task 1.6 `MarketingAsset` records are the secure binary asset library used for future social content creation.
