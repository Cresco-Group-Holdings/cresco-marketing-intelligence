# SEO Brief Schema

Structured output schema key: `seo.briefs.generate`

## Required fields

| Field | Description |
|-------|-------------|
| `workingTitle` | Proposed page title |
| `contentType` | Format (GUIDE, FAQ, PILLAR, etc.) |
| `audience` | Target reader |
| `userProblem` | Problem the content solves |
| `primaryIntent` | Search intent classification |
| `primaryKeyword` | Main target keyword |
| `secondaryKeywords` | Supporting keywords |
| `entities` | Named entities with types |
| `recommendedAngle` | Unique content angle |
| `differentiators` | Brand differentiators |
| `outline` | High-level section outline |
| `headings` | H1–H6 hierarchy with optional notes |
| `questionsToAnswer` | User questions to address |
| `faq` | FAQ items with answer guidance (not full answers) |
| `internalLinkConcepts` | Anchor/destination concepts |
| `externalEvidenceNeeds` | Citations/sources required |
| `schemaSuggestions` | Structured data recommendations |
| `cta` | Call to action |
| `tone` | Voice and tone guidance |
| `targetLengthMin/Max` | Word count range |
| `eeatChecklist` | E-E-A-T requirements |
| `complianceWarnings` | Regulatory/brand warnings |
| `successMetrics` | How to measure success |
| `limitations` | Data gaps and caveats |
| `originalityGuidance` | Anti-plagiarism instructions |

## Storage

- Full JSON stored in `SeoContentBriefVersion.structuredOutput`
- Normalised child tables for keywords, questions, headings, schema, citations, links, evidence
- AI provenance: `aiRequestId`, `aiModel`, `aiProvider`

## What is NOT included

- Full article body text
- Competitor article reproduction
- Guaranteed ranking predictions
