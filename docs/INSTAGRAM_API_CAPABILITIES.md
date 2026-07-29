# Instagram API capabilities

Verified against Meta’s official Instagram Platform documentation on 2026-07-29:

- Publishing is supported for Instagram professional accounts (Business and Creator), not personal accounts.
- With Facebook Login, the professional account must be linked to a Facebook Page. Instagram Login has a different asset/permission model; this integration uses the existing Meta/Facebook connection flow.
- Required publish permissions are `instagram_basic` and `instagram_content_publish`; `pages_read_engagement`/`pages_show_list` are required to discover Page-linked accounts in the Facebook Login flow. Meta App Review is required for production users not assigned a role on the app.
- The app user needs Page `CREATE_CONTENT` or `MANAGE` task access. Page Publishing Authorization and required Page two-factor authentication can also block publishing.
- Supported MVP formats: JPEG single image, carousel (2–10 image/video child containers), and Reel/video containers. Images use `alt_text` where Meta supports it; Meta documents this as image-post-only, not Reel/Story support.
- Media is fetched by Meta from the submitted URL. URLs must be HTTPS, provider-retrievable, short-lived signed URLs with sufficient expiry, and must not expose the asset library.
- Containers expire after 24 hours. Video/Reel processing must be polled before `/media_publish`. Publishing is a container creation followed by `/{ig-user-id}/media_publish`.
- Meta’s current docs show conflicting 50/100 post-per-24-hour statements across endpoints; this implementation must query `/{ig-user-id}/content_publishing_limit` and treat provider responses as authoritative rather than hard-coding a limit.
- Stories are deliberately not implemented in this MVP.

Official references:
- https://developers.facebook.com/docs/instagram-platform/overview
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/content-publishing
- https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/
- https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media_publish/
