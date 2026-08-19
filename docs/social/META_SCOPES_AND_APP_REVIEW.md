# Meta Scopes and App Review

## Required scopes (launch)

| Scope | Feature |
|-------|---------|
| `pages_show_list` | Discover Facebook Pages linked to the user |
| `instagram_basic` | Read Instagram Business account profile |
| `instagram_content_publish` | Publish posts via Graph API |
| `instagram_manage_insights` | Post/account metrics (analytics sync) |

## App Review

| Permission | App Review required | Evidence |
|------------|---------------------|----------|
| `instagram_content_publish` | **Yes** | Screencast: connect → create post → publish |
| `instagram_manage_insights` | **Yes** | Screencast: published post → metrics in Cresco |
| `pages_show_list` | Often standard | Page picker in connect flow |

## Development vs production

- **Development mode**: only app roles/test users can authorize.
- **Production**: requires App Review approval for permissions above.
- Do not rely on developer-only accounts for customer access.

## Reviewer instructions

1. Log in to Cresco test workspace
2. Integrations → Meta → Connect
3. Select Instagram Business test account
4. Content Studio → approved image post → Post now
5. Confirm post on Instagram test account
6. `/publishing` → Refresh metrics

Test credentials: provide Meta test user + Instagram Business sandbox in secure channel (never commit).
