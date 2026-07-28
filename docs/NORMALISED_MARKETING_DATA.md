# Normalised Marketing Data

Canonical marketing concepts are defined in `src/lib/connectors/normalized-data.ts`. They provide a provider-independent shape for future ingestion pipelines.

## Canonical concepts

| Concept | Purpose |
|---------|---------|
| `NormalisedChannel` | Platform channel or property |
| `NormalisedAccount` | Advertising or analytics account |
| `NormalisedCampaign` | Paid or organic campaign |
| `NormalisedContentItem` | Post, page, ad creative, or asset |
| `NormalisedAudience` | Segment or audience list |
| `NormalisedEvent` | Analytics or product event |
| `NormalisedConversion` | Goal or conversion action |
| `NormalisedLead` | CRM or form lead |
| `NormalisedSpend` | Advertising spend over a period |
| `NormalisedRevenue` | Revenue attribution |
| `NormalisedMetricObservation` | Time-series metric datapoint |

## Provider-specific fields

The following remain provider-specific and are stored in `providerMetadata` or connector account metadata:

- Raw API payloads
- Provider-native status enums
- Attribution models and windows
- Platform creative/asset references
- Internal provider hierarchy IDs beyond mapped canonical IDs
- Webhook signing secrets and delivery headers

## Current scope

Task 1.8 defines types only. No artificial marketing data is created. Future connector tasks will map provider payloads into these canonical shapes during sync.
