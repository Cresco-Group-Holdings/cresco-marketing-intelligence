# Workspace model

Cresco Marketing Intelligence uses a four-level workspace hierarchy:

```
Organisation
  └── Project
        └── Brand
              └── Brand Profile
```

## Organisation

The tenant root. Users access organisations through `OrganisationMembership` with roles and statuses. Organisations are soft-archived via `archivedAt` and `status = ARCHIVED`.

## Project

A product, business unit, client account, or marketing workspace inside an organisation. Project slugs are unique per organisation. Projects can be paused or archived without deleting historical records.

## Brand

A brand belongs to exactly one project. `organisationId` is stored on the brand for efficient tenant filtering. Brand slugs are unique per project.

## Brand Profile

A one-to-one structured knowledge record for each brand. This will later power AI Content Studio, SEO agents, social agents, and sales agents. Task 1.2 stores structured fields only — no AI providers are connected.

## Workspace preference

Each user has one `WorkspacePreference` record storing the current organisation, project, and brand selections plus onboarding progress. Invalid or archived selections are cleared automatically during workspace resolution.

## Example internal structure

```
Cresco Group
├── Cresco Grants Intelligence
│     └── Cresco Grants Intelligence (brand)
└── Capital Cresco Terminal
      └── Capital Cresco Terminal (brand)
```

This structure is created through onboarding or the development seed — it is not auto-created for every new user.
