# CRM Tasks

Task 6.4 operational layer for sales and marketing follow-up work.

## Models

- `CrmTask` — core task with owner, due date, status, and entity links
- `CrmTaskType` — organisation-level task type catalogue
- `CrmTaskAssignment` — assignment history
- `CrmTaskReminder` — scheduled reminders (before due, overdue, escalation)
- `CrmTaskDependency` — prerequisite relationships
- `CrmTaskCompletion` — completion outcome and next action

## Task statuses

`OPEN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `DEFERRED`, `OVERDUE`

## Task types

`CALL`, `EMAIL`, `MEETING`, `REVIEW`, `RESEARCH`, `FOLLOW_UP`, `PROPOSAL`, `DEMO`, `ONBOARDING`, `RENEWAL`, `DATA_FIX`, `OTHER`

## Relationships

Tasks may link to leads, contacts, companies, opportunities, form submissions, campaigns, and generic related entities via `relatedEntityType` / `relatedEntityId`.

## API

`GET/POST /api/brands/{brandId}/crm/tasks`

Views: `my`, `overdue`, `activities`, `follow-ups`, `taskTypes`

Actions: `createTask`, `updateTask`, `assignTask`, `completeTask`, `syncOverdue`, `logActivity`, `createFollowUpRule`, `evaluateFollowUpRules`, `generateAiSuggestion`, `acceptSuggestion`, `dismissSuggestion`

## Permissions

- `tasks.read`, `tasks.create`, `tasks.edit`, `tasks.assign`, `tasks.complete`
- `activities.read`, `activities.create`
- `followUps.read`, `followUps.manage`
- `aiFollowUp.generate`

## UI routes

- `/crm/tasks` — all tasks
- `/crm/tasks/my` — current user's tasks
- `/crm/tasks/overdue` — overdue tasks
- `/crm/activities` — activity log
- `/crm/follow-ups` — rules and suggestions

Lead detail and opportunity detail pages include task controls for creating follow-up work inline.
