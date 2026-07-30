# Sensitive Targeting Policy

## Prohibited attributes

Targeting or inferred segmentation must **not** use:

- Health conditions
- Sexuality or sexual orientation
- Religion
- Ethnicity
- Political belief
- Criminal history
- Trade union membership
- Precise sensitive locations (e.g. clinics, places of worship)

## Detection

`detectSensitiveTargeting()` scans audience names, descriptions, and rule keys for prohibited patterns. Blocking violations prevent eligibility approval.

## HumanBridge

Brands with `humanbridge` in slug require `humanBridgeSafeguards` on the consent policy. Additional purpose-limitation checks apply.

## AI planner

The AI audience planner must not recommend prohibited sensitive targeting. Output includes `prohibitedTargetingWarnings` and requires human review.

## Provider policies

Provider mappings include policy warnings for Special Ad Categories (Meta), B2B restrictions (LinkedIn), and hashed PII requirements. These are advisory only in Task 5.3.
