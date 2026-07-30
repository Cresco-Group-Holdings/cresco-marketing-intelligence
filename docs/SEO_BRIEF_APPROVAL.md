# SEO Brief Approval

Approval workflow aligned with Stage 2 Content Operations patterns.

## Status flow

```
DRAFT → GENERATED → IN_REVIEW → APPROVED
                              → CHANGES_REQUESTED → GENERATED (regenerate)
APPROVED → SUPERSEDED (new version)
Any → ARCHIVED
```

## Actions

### Submit for review
`POST /briefs/[id]?action=submit-review`

- Transitions `GENERATED` → `IN_REVIEW`
- Creates `SeoBriefApproval` with `PENDING` decision

### Approve / request changes
`POST /briefs/[id]?action=approve`

```json
{
  "decision": "APPROVED" | "CHANGES_REQUESTED" | "REJECTED",
  "decisionNote": "Optional note",
  "versionId": "Optional version reference"
}
```

### Comments
`POST /briefs/[id]?action=comment`

```json
{
  "body": "Review comment text",
  "versionId": "Optional version reference"
}
```

## Version history

`GET /briefs/[id]/history` returns:

- All `SeoContentBriefVersion` records with AI provenance
- Approval decisions with approver and timestamps
- Comment thread

## Permissions

- `seoBriefs.manage` — create, edit, submit, comment
- `seoBriefs.approve` — approve or request changes
- `seoBriefs.generate` — AI generation

## Content Operations link

Briefs may optionally link to `ContentItem` via `contentItemId` for downstream content creation. The brief itself remains separate from the generated article.
