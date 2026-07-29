# TikTok API capabilities

Verified against TikTok’s official Content Posting API documentation on 2026-07-29.

- The supported official product is the Content Posting API. Direct Post requires the approved `video.publish` scope; upload for creator completion requires `video.upload`.
- Direct Post must be enabled for the app and approved by TikTok. The target creator must authorize the corresponding scope. Unaudited clients are restricted to private/self-only visibility; public publishing requires TikTok audit approval.
- Query `/v2/post/publish/creator_info/query/` before publishing. Its `privacy_level_options` are authoritative for the selected account and must be shown to the user. Never silently replace the user’s privacy choice with public visibility.
- Direct video publishing initializes through `/v2/post/publish/video/init/`. Video transfer supports `FILE_UPLOAD` and `PULL_FROM_URL`; pull URLs require an already verified domain or URL prefix.
- Direct post settings include caption, privacy level, comment/duet/stitch controls, commercial-content disclosure, branded-content disclosure, and supported cover timestamp. The app must expose TikTok’s commercial-content disclosure choices.
- Official privacy values include `PUBLIC_TO_EVERYONE`, `MUTUAL_FOLLOW_FRIENDS`, `FOLLOWER_OF_CREATOR`, and `SELF_ONLY`, subject to creator options.
- Current documented token rate limit is 6 requests/minute per user token. Upload flows also document a maximum of five pending creator shares in 24 hours.
- The implementation supports only approved short-video assets. It must validate video dimensions, 9:16 aspect ratio, duration, H.264/MP4 compatibility, file size, captions, audio rights, disclosures, and account capability before Direct Post.
- If Direct Post is not eligible, use `video.upload`/mobile handoff or export a prepared package. This does not mark the content published; public URL confirmation remains manual.

Official references:
- https://developers.tiktok.com/doc/content-posting-api-get-started
- https://developers.tiktok.com/doc/content-posting-api-reference-direct-post
- https://developers.tiktok.com/doc/content-posting-api-reference-upload-video
- https://developers.tiktok.com/doc/content-posting-api-reference-photo-post
