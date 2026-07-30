# Ad Creative Formats

Supported `AdvertisingCreativeFormatType` values:

| Format | Typical use |
|--------|-------------|
| SEARCH_TEXT_AD | Google Search text |
| RESPONSIVE_SEARCH_AD | Google RSA |
| DISPLAY_BANNER | Display network |
| SINGLE_IMAGE | Meta/LinkedIn single image |
| CAROUSEL | Multi-card ads |
| STORY | Vertical story placements |
| REEL | Short-form vertical video |
| SHORT_VIDEO | In-feed video |
| LONG_VIDEO | YouTube/pre-roll |
| LEAD_FORM_AD | In-platform lead forms |
| DOCUMENT_AD | LinkedIn document ads |
| MESSAGE_AD | Messaging placements |
| COLLECTION | Meta collection ads |
| PERFORMANCE_MAX_ASSET | PMax asset groups |
| PROVIDER_EXTENSION | Sitelinks, callouts |

## Format adaptation

Each format stores:

- aspect ratio, resolution, max file size, max duration
- text limits per field
- safe zones (stories/reels)
- audio/subtitle/thumbnail requirements

## Channel compatibility

`CHANNEL_FORMAT_COMPATIBILITY` maps `AdvertisingChannelType` to supported formats.

## Integration

- **AI Image Studio** → `AI_IMAGE_STUDIO` assets
- **Carousel Studio** → `AI_CAROUSEL_STUDIO` assets
- **AI Video/Reels** → `AI_VIDEO_PIPELINE` assets
- **Asset Library** → `ASSET_LIBRARY` approved assets
