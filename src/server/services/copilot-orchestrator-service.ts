import type { CopilotIntent, CopilotPageContext, CopilotQueryInput, CopilotResponse, CopilotSuggestedAction } from "@/lib/copilot/types";
import { resolveCopilotDateRange } from "@/lib/copilot/date-range";
import { classifyIntent, toolsForIntent } from "@/lib/copilot/intent-router";
import { buildDailyBrief } from "@/lib/copilot/brief";
import { analyseBudgetReallocation, extractBudgetAmount } from "@/lib/copilot/diagnostics/budget";
import { diagnoseRoasChange } from "@/lib/copilot/diagnostics/roas";
import { composeAnswerSections, buildCopilotResponse } from "@/lib/copilot/response-builder";
import { rankMarketingPriorities, type MarketingPriority } from "@/lib/copilot/priorities";
import { createEvidence, createFact, createInference, createRecommendation, formatCurrency, formatMultiplier, formatPercent, resetEvidenceCounter } from "@/lib/copilot/format";
import { isAllowedCopilotTool, validateToolArgs, type CopilotToolContext } from "@/lib/copilot/tools/registry";
import { buildTenantContextForUser } from "@/lib/tenancy/guards";
import { createCopilotToolExecutors } from "@/server/services/copilot-tool-service";
import { copilotConversationService } from "@/server/services/copilot-conversation-service";
import { workspaceService } from "@/server/services/workspace-service";
import { aiRequestService } from "@/server/services/ai-request-service";
import type { TenantContext } from "@/lib/tenancy/context";

const DEFAULT_LIMIT = 10;

function resolveDateContext(pageContext: CopilotPageContext) {
  return resolveCopilotDateRange(pageContext.dateRange);
}

async function runTools(
  toolNames: string[],
  context: CopilotToolContext,
  tenant: TenantContext,
) {
  const executors = createCopilotToolExecutors(tenant);
  const results: Record<string, Awaited<ReturnType<(typeof executors)[string]>>> = {};
  const evidence = [];
  const limitations: string[] = [];
  let coverage: number | null = null;
  let sampleSize: number | null = null;
  let truncated = false;

  for (const name of toolNames) {
    if (!isAllowedCopilotTool(name)) continue;
    validateToolArgs({
      toolName: name,
      brandId: context.brandId,
      organisationId: context.organisationId,
      from: context.from,
      to: context.to,
    });
    const result = await executors[name](context).catch(
      (): import("@/lib/copilot/types").CopilotToolResult => ({
        data: null,
        evidence: [],
        limitations: [`${name} unavailable.`],
      }),
    );
    results[name] = result;
    evidence.push(...result.evidence);
    if (result.limitations) limitations.push(...result.limitations);
    if (result.coverage != null) coverage = result.coverage;
    if (result.sampleSize != null) sampleSize = result.sampleSize;
    if (result.truncated) truncated = true;
  }

  return { results, evidence, limitations, coverage, sampleSize, truncated };
}

function defaultActions(intent: CopilotIntent): CopilotSuggestedAction[] {
  const actions: CopilotSuggestedAction[] = [];
  if (intent === "paid" || intent === "diagnosis" || intent === "budget") {
    actions.push(
      { id: "open-campaigns", type: "navigate", label: "View campaigns", href: "/advertising/campaigns" },
      { id: "open-creatives", type: "navigate", label: "Review creatives", href: "/advertising/creatives" },
      { id: "open-budgets", type: "navigate", label: "Review budget allocation", href: "/advertising/budgets" },
    );
  }
  if (intent === "content" || intent === "organic" || intent === "publishing") {
    actions.push(
      { id: "open-studio", type: "navigate", label: "Create content draft", href: "/content/studio/new" },
      { id: "open-calendar", type: "navigate", label: "Open calendar", href: "/calendar" },
    );
  }
  if (intent === "attribution" || intent === "revenue") {
    actions.push(
      { id: "open-analytics", type: "navigate", label: "Review attribution", href: "/analytics/attribution" },
      { id: "open-revenue", type: "navigate", label: "Open revenue analytics", href: "/analytics/revenue" },
    );
  }
  if (intent === "data-quality") {
    actions.push({
      id: "open-data-health",
      type: "navigate",
      label: "Review tracking",
      href: "/analytics/executive/data-health",
    });
  }
  return actions;
}

async function handleIntent(input: {
  intent: CopilotIntent;
  question: string;
  pageContext: CopilotPageContext;
  toolContext: CopilotToolContext;
  tenant: TenantContext;
  rangeLabel: string;
}): Promise<CopilotResponse> {
  const toolNames = toolsForIntent(input.intent);
  const { results, evidence, limitations, coverage, sampleSize, truncated } = await runTools(
    toolNames,
    input.toolContext,
    input.tenant,
  );

  const actions = defaultActions(input.intent);
  const modelNote = input.pageContext.attributionModel
    ? `Under the currently selected ${input.pageContext.attributionModel} model, `
    : "";

  if (input.intent === "brief" || /daily (marketing )?brief/i.test(input.question)) {
    const overview = results.getMarketingOverview?.data as { overview?: { kpis: Record<string, { value: number | null; previous: { value: number | null }; available: boolean }> }; anomalies?: Array<{ metricKey: string; changePercent: number; direction: string }> } | null;
    const paid = results.getPaidPerformance?.data as { current?: { spend: number; conversions: number }; previous?: { spend: number } } | null;
    const organic = results.getOrganicPerformance?.data as { derived?: { engagementRate?: number | null } } | null;
    const signals = results.getMarketingSignals?.data as { anomalies?: Array<{ metricKey: string; changePercent: number; direction: string }> } | null;
    const priorities = buildPriorityList(results, input.intent);
    const brief = buildDailyBrief({
      periodLabel: input.rangeLabel,
      changed: [
        ...(overview?.anomalies?.slice(0, 2).map((item) => ({
          label: item.metricKey,
          change: `${item.direction === "DOWN" ? "" : "+"}${item.changePercent.toFixed(1)}%`,
        })) ?? []),
        ...(paid?.current
          ? [{ label: "Paid spend", change: formatCurrency(paid.current.spend) }]
          : []),
      ],
      attention: priorities.slice(0, 2).map((item) => ({
        title: item.title,
        reason: item.reason,
        evidence: item.evidence,
      })),
      opportunities: [
        {
          title: "Review high-performing channels",
          reason: "Compare paid channel efficiency before increasing spend.",
        },
      ],
      risks: limitations.slice(0, 2),
      contentGaps:
        (results.getPublishingSchedule?.data as { scheduled?: number } | null)?.scheduled === 0
          ? ["No content scheduled for the next 14 days."]
          : [],
      dataQuality:
        (results.getDataCoverage?.limitations?.[0] as string | undefined) ??
        "Measurement quality appears stable for connected sources.",
      priorities,
    });
    return buildCopilotResponse({
      intent: "brief",
      answer: brief.answer,
      briefSections: brief.sections,
      facts: priorities.slice(0, 2).map((item) => createFact(item.reason, item.evidence.map((ev) => ev.id))),
      recommendations: priorities.slice(0, 3).map((item) =>
        createRecommendation(item.title, item.evidence.map((ev) => ev.id)),
      ),
      evidence: [...evidence, ...priorities.flatMap((item) => item.evidence)],
      suggestedActions: brief.actions,
      limitations,
      coverage,
      sampleSize,
      truncated,
      outputSource: "deterministic",
    });
  }

  if (input.intent === "priorities" || /what should i do today|top (5|five)/i.test(input.question)) {
    const priorities = buildPriorityList(results, input.intent);
    const answer = priorities
      .slice(0, 5)
      .map((item, index) => `${index + 1}. ${item.title} — ${item.reason}`)
      .join("\n");
    return buildCopilotResponse({
      intent: "priorities",
      answer: answer || "No high-priority marketing actions identified for the current period.",
      facts: priorities.map((item) => createFact(item.reason, item.evidence.map((ev) => ev.id))),
      recommendations: priorities.slice(0, 3).map((item) =>
        createRecommendation(item.title, item.evidence.map((ev) => ev.id)),
      ),
      evidence: [...evidence, ...priorities.flatMap((item) => item.evidence)],
      suggestedActions: priorities
        .map((item) => item.action)
        .filter((action): action is CopilotSuggestedAction => action != null),
      limitations,
      coverage,
      sampleSize,
      truncated,
      outputSource: "deterministic",
    });
  }

  if (input.intent === "budget") {
    const amount = extractBudgetAmount(input.question) ?? 5000;
    const paid = results.getPaidPerformance?.data as {
      current?: { spend: number; conversions: number; byProvider?: Record<string, Record<string, number>> };
    } | null;
    const channels = Object.entries(paid?.current?.byProvider ?? {}).map(([provider, metrics]) => {
      const spend = metrics.cost ?? 0;
      const conversions = metrics.conversions ?? 0;
      const revenue = metrics.conversion_value ?? 0;
      return {
        channel: provider,
        roas: spend > 0 ? revenue / spend : null,
        cpa: conversions > 0 ? spend / conversions : null,
        spend,
        spendShare: paid?.current?.spend ? spend / paid.current.spend : 0,
        conversions,
        trend: "unknown" as const,
        freshness: "fresh",
      };
    });
    const analysis = analyseBudgetReallocation({ amount, channels, limitations });
    return buildCopilotResponse({
      intent: "budget",
      answer: composeAnswerSections({
        summary: analysis.summary,
        facts: analysis.facts,
        inferences: [],
        recommendations: analysis.recommendations,
      }),
      facts: analysis.facts,
      recommendations: analysis.recommendations,
      evidence: [...evidence, ...analysis.evidence],
      suggestedActions: actions,
      followUpQuestions: ["Show affected campaigns", "Compare with previous month"],
      limitations: [...limitations, "Budget recommendations are advisory only and do not execute changes."],
      coverage,
      sampleSize,
      truncated,
      outputSource: "deterministic",
    });
  }

  if (/roas/i.test(input.question) && (input.intent === "diagnosis" || input.intent === "paid")) {
    const paid = results.getPaidPerformance?.data as {
      current?: { spend: number; conversions: number; clicks: number; impressions: number; byProvider?: Record<string, Record<string, number>> };
      previous?: { spend: number; conversions: number; clicks: number; impressions: number; byProvider?: Record<string, Record<string, number>> };
    } | null;
    const attribution = results.getAttributionSummary?.data as {
      attributedRevenue?: number;
      channelBreakdown?: Array<{ channel: string; creditValue: number }>;
    } | null;
    const previousAttribution = attribution;
    const currentRevenue = attribution?.attributedRevenue ?? 0;
    const previousRevenue = currentRevenue;
    const currentSpend = paid?.current?.spend ?? 0;
    const previousSpend = paid?.previous?.spend ?? 0;
    const currentRoas = currentSpend > 0 ? currentRevenue / currentSpend : null;
    const previousRoas = previousSpend > 0 ? previousRevenue / previousSpend : null;

    const providerBreakdown = Object.keys({
      ...(paid?.current?.byProvider ?? {}),
      ...(paid?.previous?.byProvider ?? {}),
    }).map((provider) => {
      const currentMetrics = paid?.current?.byProvider?.[provider] ?? {};
      const previousMetrics = paid?.previous?.byProvider?.[provider] ?? {};
      const currentProviderSpend = currentMetrics.cost ?? 0;
      const previousProviderSpend = previousMetrics.cost ?? 0;
      const currentProviderRevenue = currentMetrics.conversion_value ?? 0;
      const previousProviderRevenue = previousMetrics.conversion_value ?? 0;
      const currentProviderRoas =
        currentProviderSpend > 0 ? currentProviderRevenue / currentProviderSpend : null;
      const previousProviderRoas =
        previousProviderSpend > 0 ? previousProviderRevenue / previousProviderSpend : null;
      const currentConversions = currentMetrics.conversions ?? 0;
      const previousConversions = previousMetrics.conversions ?? 0;
      return {
        provider,
        currentSpend: currentProviderSpend,
        previousSpend: previousProviderSpend,
        currentRevenue: currentProviderRevenue,
        previousRevenue: previousProviderRevenue,
        currentRoas: currentProviderRoas,
        previousRoas: previousProviderRoas,
        currentCpa: currentConversions > 0 ? currentProviderSpend / currentConversions : null,
        previousCpa: previousConversions > 0 ? previousProviderSpend / previousConversions : null,
        currentCtr:
          (currentMetrics.impressions ?? 0) > 0
            ? (currentMetrics.clicks ?? 0) / (currentMetrics.impressions ?? 1)
            : null,
        previousCtr:
          (previousMetrics.impressions ?? 0) > 0
            ? (previousMetrics.clicks ?? 0) / (previousMetrics.impressions ?? 1)
            : null,
        conversions: currentConversions,
      };
    });

    const diagnosis = diagnoseRoasChange({
      currentRoas,
      previousRoas,
      currentSpend,
      previousSpend,
      currentRevenue,
      previousRevenue,
      providerBreakdown,
      periodLabel: input.rangeLabel,
    });

    return buildCopilotResponse({
      intent: input.intent,
      answer: composeAnswerSections({
        summary: diagnosis.summary,
        facts: diagnosis.facts,
        inferences: diagnosis.inferences,
        recommendations: diagnosis.recommendations,
      }),
      facts: diagnosis.facts,
      inferences: diagnosis.inferences,
      recommendations: diagnosis.recommendations,
      evidence: [...evidence, ...diagnosis.evidence],
      suggestedActions: actions,
      followUpQuestions: ["Show affected campaigns", "Where should I move budget?"],
      limitations,
      coverage,
      sampleSize,
      truncated,
      outputSource: "deterministic",
    });
  }

  if (input.intent === "data-quality" || /can i trust|data (missing|quality)/i.test(input.question)) {
    resetEvidenceCounter();
    const coverageFacts = [
      createFact(
        `Current measurement quality is being assessed from executive data health and attribution coverage.`,
        evidence.map((item) => item.id),
      ),
    ];
    if (coverage != null) {
      coverageFacts.push(
        createFact(`Attribution coverage is approximately ${coverage.toFixed(0)}%.`, evidence.map((item) => item.id)),
      );
    }
    return buildCopilotResponse({
      intent: "data-quality",
      answer: composeAnswerSections({
        summary: "Here is the current measurement quality for your workspace.",
        facts: coverageFacts,
        inferences: [],
        recommendations: limitations.length
          ? [createRecommendation("Review tracking connections and resolve listed data gaps before making major budget decisions.", evidence.map((item) => item.id))]
          : [],
      }),
      facts: coverageFacts,
      recommendations: limitations.length
        ? [createRecommendation("Review tracking connections before major budget decisions.", evidence.map((item) => item.id))]
        : [],
      evidence,
      suggestedActions: actions,
      limitations,
      coverage,
      sampleSize,
      truncated,
      outputSource: "deterministic",
    });
  }

  if (input.intent === "attribution" || input.intent === "revenue") {
    const attribution = results.getAttributionSummary?.data as {
      attributedRevenue?: number;
      channelBreakdown?: Array<{ channel: string; creditValue: number; conversions: number }>;
      unattributedConversions?: number;
    } | null;
    const revenue = results.getRevenueAnalytics?.data as { totalRevenue?: number } | null;
    const facts = [
      createFact(
        `${modelNote}${attribution?.channelBreakdown?.[0]?.channel ?? "No channel"} receives the largest attributed revenue share in the selected period.`,
        evidence.map((item) => item.id),
      ),
    ];
    if (revenue?.totalRevenue != null && attribution?.attributedRevenue != null) {
      facts.push(
        createFact(
          `Observed revenue is ${formatCurrency(revenue.totalRevenue)} versus ${formatCurrency(attribution.attributedRevenue)} attributed.`,
          evidence.map((item) => item.id),
        ),
      );
    }
    return buildCopilotResponse({
      intent: input.intent,
      answer: composeAnswerSections({
        summary: `${modelNote}attribution analysis for ${input.rangeLabel}.`,
        facts,
        inferences: [],
        recommendations: [],
      }),
      facts,
      evidence,
      suggestedActions: actions,
      followUpQuestions: ["Explain the evidence", "Compare attribution models"],
      limitations: [...limitations, "Assisted revenue remains distinct from attributed revenue."],
      coverage,
      sampleSize,
      truncated,
      outputSource: "deterministic",
    });
  }

  if (input.intent === "content" || input.intent === "organic" || input.intent === "publishing") {
    const content = results.getContentPerformance?.data as {
      content?: Array<{ label: string; totals?: { impressions?: number; reach?: number } }>;
    } | null;
    const schedule = results.getPublishingSchedule?.data as { scheduled?: number; published?: number } | null;
    const facts = [
      createFact(
        `${schedule?.scheduled ?? 0} items scheduled for the next 14 days; ${schedule?.published ?? 0} published in the selected period.`,
        evidence.map((item) => item.id),
      ),
    ];
    const topContent = content?.content?.[0];
    const recommendations = topContent
      ? [
          createRecommendation(
            `Consider building on "${topContent.label}" — it is among the strongest content items in the current period.`,
            evidence.map((item) => item.id),
          ),
        ]
      : [
          createRecommendation(
            "Create one Reel or Short if no short-form content is scheduled in the next week.",
            evidence.map((item) => item.id),
          ),
        ];
    return buildCopilotResponse({
      intent: input.intent,
      answer: composeAnswerSections({
        summary: "Here are content and publishing recommendations based on current performance.",
        facts,
        inferences: [],
        recommendations,
      }),
      facts,
      recommendations,
      evidence,
      suggestedActions: actions,
      followUpQuestions: ["What should I repurpose?", "Which format is growing fastest?"],
      limitations,
      coverage,
      sampleSize,
      truncated,
      outputSource: "deterministic",
    });
  }

  const overview = results.getMarketingOverview?.data as {
    anomalies?: Array<{ metricKey: string; changePercent: number; direction: string }>;
  } | null;
  const facts =
    overview?.anomalies?.slice(0, 3).map((anomaly) =>
      createFact(
        `${anomaly.metricKey} changed ${formatPercent(anomaly.changePercent)} (${anomaly.direction.toLowerCase()}).`,
        evidence.map((item) => item.id),
      ),
    ) ?? [
      createFact("I reviewed the latest marketing overview for the selected period.", evidence.map((item) => item.id)),
    ];

  return buildCopilotResponse({
    intent: input.intent,
    answer: composeAnswerSections({
      summary: `Here is what I found for ${input.rangeLabel}.`,
      facts,
      inferences: [],
      recommendations: [],
    }),
    facts,
    evidence,
    suggestedActions: actions,
    followUpQuestions: ["What should I do next?", "Explain the evidence"],
    limitations,
    coverage,
    sampleSize,
    truncated,
    outputSource: "deterministic",
  });
}

function buildPriorityList(
  results: Record<string, { data?: unknown; evidence?: import("@/lib/copilot/types").EvidenceItem[] }>,
  intent: CopilotIntent,
): MarketingPriority[] {
  const anomalies =
  (results.getMarketingSignals?.data as { anomalies?: Array<{ metricKey: string; changePercent: number; direction: string; sampleSize: number }> } | null)
      ?.anomalies ?? [];
  const schedule = results.getPublishingSchedule?.data as { scheduled?: number } | null;

  const candidates: Array<Omit<MarketingPriority, "score">> = anomalies.slice(0, 4).map((anomaly, index) => ({
    id: `priority-anomaly-${anomaly.metricKey}`,
    title: `Review ${anomaly.metricKey} change`,
    reason: `${anomaly.metricKey} moved ${formatPercent(anomaly.changePercent)} versus the comparison period.`,
    impact: Math.abs(anomaly.changePercent) >= 30 ? "high" : "medium",
    urgency: anomaly.direction === "DOWN" ? "high" : "medium",
    confidence: anomaly.sampleSize >= 20 ? "moderate" : "limited",
    evidence: [
      createEvidence({
        label: anomaly.metricKey,
        metric: anomaly.metricKey,
        value: formatPercent(anomaly.changePercent),
        sampleSize: anomaly.sampleSize,
        source: "Deterministic anomaly detection",
      }),
    ],
    action: {
      id: `action-${index}`,
      type: "navigate",
      label: "Open analytics",
      href: "/analytics",
    },
  }));

  if ((schedule?.scheduled ?? 0) === 0) {
    candidates.push({
      id: "priority-publishing-gap",
      title: "Fill publishing schedule gap",
      reason: "No content is scheduled for the next 14 days.",
      impact: "medium",
      urgency: "medium",
      confidence: "high",
      evidence: [
        createEvidence({
          label: "Scheduled content",
          value: 0,
          source: "Publishing queue",
        }),
      ],
      action: { id: "open-calendar", type: "navigate", label: "Open calendar", href: "/calendar" },
    });
  }

  if (intent === "paid" || intent === "budget") {
    candidates.push({
      id: "priority-review-paid",
      title: "Review paid campaign efficiency",
      reason: "Check campaign and creative performance before reallocating budget.",
      impact: "high",
      urgency: "medium",
      confidence: "moderate",
      evidence: [],
      action: { id: "open-campaigns", type: "navigate", label: "View campaigns", href: "/advertising/campaigns" },
    });
  }

  return rankMarketingPriorities(candidates);
}

export const copilotOrchestratorService = {
  async query(
    userProfileId: string,
    input: CopilotQueryInput,
    requestId?: string,
  ): Promise<{ response: CopilotResponse; conversationId: string }> {
    const workspace = await workspaceService.getResolvedWorkspace(userProfileId);
    const organisationId = workspace.preference.currentOrganisationId;
    const brandId = workspace.preference.currentBrandId;

    if (!organisationId) {
      throw new Error("Organisation context is required.");
    }

    const tenant = await buildTenantContextForUser(userProfileId, {
      organisationId,
      projectId: workspace.preference.currentProjectId ?? undefined,
      brandId: brandId ?? undefined,
    });

    const range = resolveDateContext(input.pageContext);
    const toolContext: CopilotToolContext = {
      brandId: brandId ?? "",
      organisationId,
      from: range.from,
      to: range.to,
      comparisonFrom: range.comparisonFrom,
      comparisonTo: range.comparisonTo,
      attributionModel: input.pageContext.attributionModel,
      limit: DEFAULT_LIMIT,
    };

    if (!brandId) {
      return {
        conversationId: input.conversationId ?? "no-brand",
        response: buildCopilotResponse({
          intent: "general",
          answer: "Select a brand to ask Cresco marketing questions with full analytics context.",
          facts: [],
          evidence: [],
          limitations: ["Brand context required."],
          suggestedActions: [
            { id: "open-brands", type: "navigate", label: "Select brand", href: "/brands" },
          ],
          outputSource: "deterministic",
        }),
      };
    }

    const intent = classifyIntent(input.question, input.pageContext);
    let response = await handleIntent({
      intent,
      question: input.question,
      pageContext: input.pageContext,
      toolContext,
      tenant,
      rangeLabel: range.label,
    });

    if (requestId) {
      try {
        const synthesis = await aiRequestService.executeStructured(
          {
            organisationId,
            projectId: workspace.preference.currentProjectId ?? undefined,
            brandId,
            userProfileId,
            purpose: "ANALYTICS_INSIGHT",
            schemaKey: "copilot.synthesis",
            templateKey: "copilot.synthesis",
            userInput: JSON.stringify({
              question: input.question,
              intent,
              facts: response.facts,
              inferences: response.inferences,
              recommendations: response.recommendations,
              evidence: response.evidence,
            }),
            requestId,
          },
          tenant,
        );
        const result = synthesis.output;
        if (result) {
          response = {
            ...response,
            answer: composeAnswerSections({
              summary: result.summary,
              facts: result.factStatements.map((statement, index) =>
                createFact(statement, response.facts[index]?.evidenceIds ?? []),
              ),
              inferences: result.inferenceStatements.map((statement, index) =>
                createInference(statement, response.inferences[index]?.evidenceIds ?? []),
              ),
              recommendations: result.recommendationStatements.map((statement, index) =>
                createRecommendation(statement, response.recommendations[index]?.evidenceIds ?? []),
              ),
            }),
            followUpQuestions: result.followUpQuestions,
            outputSource: "hybrid",
          };
        }
      } catch {
        // Deterministic fallback remains available.
      }
    }

    let conversationId = input.conversationId;
    if (!conversationId) {
      const conversation = await copilotConversationService.createConversation({
        organisationId,
        brandId,
        userProfileId,
        title: input.question,
        pageContext: input.pageContext,
      });
      conversationId = conversation.id;
    }

    await copilotConversationService.addMessage({
      conversationId,
      role: "user",
      content: input.question,
    });
    await copilotConversationService.addMessage({
      conversationId,
      role: "assistant",
      content: response.answer,
      response,
    });

    return { response, conversationId };
  },

  async getConversation(userProfileId: string, conversationId: string) {
    const workspace = await workspaceService.getResolvedWorkspace(userProfileId);
    const organisationId = workspace.preference.currentOrganisationId;
    if (!organisationId) return null;
    const conversation = await copilotConversationService.getConversation(
      conversationId,
      userProfileId,
      organisationId,
    );
    return conversation ? copilotConversationService.toRecord(conversation) : null;
  },

  async listConversations(userProfileId: string) {
    const workspace = await workspaceService.getResolvedWorkspace(userProfileId);
    const organisationId = workspace.preference.currentOrganisationId;
    if (!organisationId) return [];
    const conversations = await copilotConversationService.listConversations(
      userProfileId,
      organisationId,
    );
    return conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
      lastMessage: conversation.messages[0]?.content ?? "",
    }));
  },
};
