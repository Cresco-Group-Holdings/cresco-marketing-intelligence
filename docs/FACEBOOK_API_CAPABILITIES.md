# Facebook API capabilities

Verified against Meta’s official Pages API and Video API documentation on 2026-07-29.

- Publishing is supported to Facebook Pages through official Page endpoints; personal-profile publishing is not implemented.
- Text and links use `/{page-id}/feed`; photos use `/{page-id}/photos`; multiple photos are uploaded unpublished and attached to a feed post.
- Page video publishing uses the Video API. Facebook Page Reels are supported through the official Video API where enabled for the Page.
- Required Page permissions are `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts`; the token owner must have the Page `CREATE_CONTENT` task. Meta App Review is required for production use.
- Publishing uses a Page access token. The selected Page must belong to the same connected account and tenant.
- Provider error code 190 indicates an expired token; code 200 is commonly a permission failure; codes 368 and policy-related errors are terminal; upload/fetch failures can be retried where safe.

Official references:

- https://developers.facebook.com/docs/pages-api/posts/
- https://developers.facebook.com/docs/pages-api/
- https://developers.facebook.com/docs/video-api/guides/publishing/
