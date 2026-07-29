# X API capabilities

Verified against the official X API documentation on 2026-07-29.

- Posts are created with `POST /2/tweets` using user-context OAuth authorization.
- Text, replies, media posts, and ordered threads are supported subject to the connected app’s paid entitlement and endpoint limits.
- Media is uploaded before posting. Large/video media uses INIT, APPEND, FINALIZE, and STATUS processing.
- Threads are reply chains: each subsequent post uses the prior returned post ID. Self-serve reply restrictions still apply.
- Access is not assumed to be free. Entitlement, request limits, media limits, and HTTP 429 responses must be handled as deployment/account policy.
- Automated engagement spam is not implemented.

Official references:

- https://docs.x.com/x-api/posts/manage-tweets/introduction
- https://docs.x.com/x-api/posts/manage-tweets/quickstart
- https://docs.x.com/x-api/media/quickstart/media-upload-chunked
