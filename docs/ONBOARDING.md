# Onboarding

Authenticated users without a completed workspace are redirected to `/onboarding`.

## Steps

1. Create organisation
2. Create first project
3. Create first brand
4. Complete essential brand profile fields (optional but recommended)
5. Enter dashboard

## Behaviour

- Progress is stored in `WorkspacePreference.onboardingStep`
- Completion is stored in `WorkspacePreference.onboardingCompletedAt`
- Users can go back between steps
- Retrying a step does not create duplicate organisations when using the same slug (validation error instead)
- Non-essential profile fields can be skipped
- On completion, users are redirected to `/dashboard`

## Internal example values

The onboarding UI pre-fills example names such as **Cresco Group** and **Cresco Grants Intelligence** to support the first internal setup. These are editable defaults, not automatic seed data for every user.

## Development seed

For local development, run:

```bash
SEED_AUTH_USER_ID=your-supabase-user-id npm run db:seed:development
```

This creates the Cresco Group workspace structure only when explicitly invoked.
