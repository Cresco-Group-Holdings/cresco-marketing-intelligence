# Audience Rules

## Approved rule keys

Only these rule keys may be used — arbitrary database fields are not exposed:

- `event_occurred`, `page_viewed`, `content_viewed`, `form_submitted`
- `signup_status`, `trial_status`, `subscription_status`
- `lead_stage`, `last_activity_date`, `campaign_interaction`
- `geographic_country`, `language`, `product`, `plan`, `customer_value_band`

## Operators

`EQUALS`, `NOT_EQUALS`, `GREATER_THAN`, `LESS_THAN`, `IN`, `NOT_IN`, `OCCURRED_WITHIN`, `NOT_OCCURRED_WITHIN`, `IS_TRUE`, `IS_FALSE`

## Validation

`validateRule()` rejects keys outside the allowlist. Rules are stored on `AdvertisingAudienceRule` with JSON values.

## Logic groups

Rules support `logicGroup` (default `AND`) for future compound logic. Segments use `AdvertisingAudienceSegment.segmentLogic` for grouped conditions.
