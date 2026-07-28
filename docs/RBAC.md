# Role-based access control

Permissions are defined centrally in `src/lib/tenancy/permissions.ts` and enforced server-side through `withApiHandler` and domain services.

## Permission matrix

| Permission | OWNER | ADMIN | MARKETER | ANALYST | VIEWER |
| --- | --- | --- | --- | --- | --- |
| organisation.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| organisation.update | ✓ | ✓ | | | |
| organisation.archive | ✓ | | | | |
| members.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| members.invite | ✓ | ✓ | | | |
| members.updateRole | ✓ | ✓ | | | |
| members.remove | ✓ | ✓ | | | |
| projects.create | ✓ | ✓ | ✓ | | |
| projects.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| projects.update | ✓ | ✓ | ✓ | | |
| projects.archive | ✓ | ✓ | | | |
| brands.create | ✓ | ✓ | ✓ | | |
| brands.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| brands.update | ✓ | ✓ | ✓ | | |
| brands.archive | ✓ | ✓ | | | |
| brandProfile.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| brandProfile.update | ✓ | ✓ | ✓ | | |
| brandKnowledge.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| brandKnowledge.update | ✓ | ✓ | ✓ | | |
| marketingAssets.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| marketingAssets.update | ✓ | ✓ | ✓ | | |
| ai.diagnostics | ✓ | ✓ | | | |
| ai.usage.read | ✓ | ✓ | | ✓ | |
| connectors.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| connectors.update | ✓ | ✓ | ✓ | | |
| auditLogs.read | ✓ | ✓ | | ✓ | |

## Special rules

- At least one active `OWNER` must remain in an organisation.
- The final owner cannot remove or demote themselves.
- Admins cannot promote users to `OWNER`.
- Admins cannot change or remove `OWNER` memberships.
- Suspended or removed members cannot access organisation data.

## Membership statuses

- `ACTIVE` — full access according to role
- `INVITED` — reserved for invitation flow before acceptance
- `SUSPENDED` — access blocked, record retained
- `REMOVED` — access revoked, record retained for audit history
