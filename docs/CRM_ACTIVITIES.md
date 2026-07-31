# CRM Activities

User-logged CRM activity records. Activities are never fabricated from unverified external data.

## Models

- `CrmActivity` — call, email, meeting, note, and other logged events
- `CrmActivityParticipant` — people and users involved
- `CrmNote` — note content linked to a note activity
- `CrmCallLog` — call direction, duration, disposition
- `CrmMeetingRecord` — meeting scheduling and calendar integration metadata

## Activity types

`CALL`, `EMAIL`, `MEETING`, `NOTE`, `TASK`, `FORM_SUBMISSION`, `STATUS_CHANGE`, `OTHER`

## Visibility

`STANDARD`, `RESTRICTED`, `PRIVATE`

## Logging

Use `POST /api/brands/{brandId}/crm/tasks` with `action: "logActivity"`.

Required fields: `activityType`, `title`

Optional: `summary`, `outcome`, `nextAction`, `durationMinutes`, `visibility`, entity links, `participants`, `noteContent`, `call`, `meeting`

When an activity is logged against a lead or opportunity, `lastActivityAt` is updated. Opportunity `nextAction` is updated when provided.

## Calendar foundation

`CrmMeetingRecord` stores `calendarProvider` (`GOOGLE`, `MICROSOFT`, `SCHEDULING_PROVIDER`) and `externalEventId` for future sync. Private calendar details beyond authorised scope are not exposed.
