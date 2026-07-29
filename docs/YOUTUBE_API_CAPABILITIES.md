# YouTube API capabilities

Verified against the official YouTube Data API v3 documentation on 2026-07-29.

- Videos and Shorts use `videos.insert`; Shorts are ordinary videos that meet current vertical-format and duration expectations. Classification does not rely on title text.
- Upload requires OAuth user authorization with `youtube.upload` or a broader YouTube scope and should use the resumable upload protocol.
- Metadata supports title, description, tags, category, privacy, `publishAt`, and `selfDeclaredMadeForKids`.
- Scheduled publication requires a private video and a valid future `status.publishAt`.
- Custom thumbnails use `thumbnails.set` after a video ID exists.
- Processing is reconciled through `videos.list` processing details.
- Projects created after 2020 that have not passed YouTube’s audit are restricted to private uploads.
- Quotas are project-specific and changeable. Uploads consume the dedicated upload quota; all requests consume quota. The implementation treats `quotaExceeded` as terminal until quota resets and does not repeatedly retry it.

Official references:

- https://developers.google.com/youtube/v3/docs/videos/insert
- https://developers.google.com/youtube/v3/guides/uploading_a_video
- https://developers.google.com/youtube/v3/getting-started
