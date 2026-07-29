# LinkedIn API capabilities

Verified against LinkedIn’s official Posts API documentation on 2026-07-29.

- The current official publishing endpoint is `POST /rest/posts`; it replaces `ugcPosts`.
- Organic posts support text, image, multi-image, video, document, article/link, poll, and celebration content. Organic carousel posts are **not** supported; a PDF document post must be described as a document, not a carousel.
- Member posting requires `w_member_social` and an author URN of `urn:li:person:{id}`.
- Organisation posting requires `w_organization_social`, an author URN of `urn:li:organization:{id}`, and an authenticated member with `ADMINISTRATOR`, `DIRECT_SPONSORED_CONTENT_POSTER`, or `CONTENT_ADMIN` access to that organisation. The user must explicitly select the author identity.
- Images, videos, and documents must be uploaded using their respective LinkedIn upload APIs before their asset URNs are referenced by a post.
- Requests require `Linkedin-Version: YYYYMM` and `X-Restli-Protocol-Version: 2.0.0`.
- Access to organisation and restricted social APIs requires LinkedIn product access and review.

Official reference:

- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
