# Stage 5 Known Limitations

## Provider limitations

| Limitation | Impact | Workaround |
|------------|--------|------------|
| Google: Search campaigns only | No Display, PMax, Video, Shopping | Use Google Ads UI for unsupported types |
| Meta: App review for non-owned accounts | Cannot launch on client accounts without review | Beta on owned test accounts |
| LinkedIn: Document ads disabled | Cannot create document ad creatives | Use single-image or video |
| LinkedIn: Matched audiences disabled | No customer list upload | Planning and rule-based audiences only |
| TikTok: Spark Ads disabled | No creator identity ads | Standard video ads only |
| TikTok: Sandbox disabled | No isolated sandbox testing | Low-spend production test accounts |
| Live policy review polling | No automatic ad review status | Manual check in provider UI |
| Google/Meta not on shared adapter | Two integration patterns | Use provider-specific UI and APIs |

## Feature limitations

| Limitation | Impact |
|------------|--------|
| Audience external activation | Audiences planned but not uploaded to providers |
| Cross-currency FX for pacing | Missing rates exclude amounts from totals |
| Provider-side emergency pause | Platform blocks mutations; does not call provider pause API |
| Sensitive targeting detection | Regex-based, English-centric; may miss edge cases |
| Creative compliance | Client-side rules; not live provider API validation |
| Experiment randomisation | Platform disclaimer; provider may not guarantee random assignment |
| AI optimisation | Rule-based analysis engine; not live LLM synthesis in all paths |

## Operational requirements

- Manual provider account setup and OAuth connection
- Manual verification of conversion tracking before launch
- Weekly spend reconciliation against provider billing
- Human review of all AI recommendations before action
- OWNER/ADMIN approval for launches and budget increases

## Beta spending limits

- Recommended maximum: organisation hard limit policy (default 50% increase cap)
- Daily change limit: 20% without escalation
- Test accounts: provider minimum budgets only
