import type { z } from "zod";
import { SocialProvider } from "@prisma/client";
import type {
  AIProviderStructuredRequest,
  AIProviderStructuredResponse,
  AIProviderTextRequest,
  AIProviderTextResponse,
} from "@/lib/ai/types";
import { BaseAIProvider } from "@/lib/ai/providers/base";
import { aiResponseParser } from "@/lib/ai/response-parser";

function defaultPlatforms(): SocialProvider[] {
  return ["LINKEDIN", "INSTAGRAM"];
}

function mockSocialContent(schemaName: string) {
  const platforms = schemaName.includes("linkedin")
    ? ["LINKEDIN"]
    : schemaName.includes("facebook")
      ? ["FACEBOOK"]
      : schemaName.includes("youtube")
        ? ["YOUTUBE"]
        : defaultPlatforms();

  return {
    hook: "Discover smarter ways to grow your brand.",
    body: "Share practical insights that help your audience take the next step with confidence.",
    caption:
      "Ready to create content that resonates? Start with a clear message and a strong hook.",
    headline: "Brand content that connects",
    cta: "Learn more",
    hashtags: ["#marketing", "#brand", "#content"],
    videoScript:
      "Hook: Stop scrolling — here is what matters.\nScene 1: Problem.\nScene 2: Solution.\nCTA: Learn more.",
    sceneSuggestions: ["Open with a bold text overlay", "Cut to product demo", "End with CTA card"],
    visualBrief: "Clean brand colours, bold typography, energetic pacing.",
    complianceNotes: [],
    platformAdaptations: platforms.map((provider) => ({
      provider,
      caption: `Platform-ready caption for ${provider}.`,
      headline: "Headline",
      hashtags: ["#brand", "#content"],
      hook: "Strong hook",
      cta: "Learn more",
    })),
  };
}

export class MockAIProvider extends BaseAIProvider {
  readonly name = "MOCK" as const;

  isConfigured(): boolean {
    return true;
  }

  async generateText(request: AIProviderTextRequest): Promise<AIProviderTextResponse> {
    this.guardAbort(request.signal);
    const started = Date.now();
    const userMessage = request.messages.find((message) => message.role === "user")?.content ?? "";
    const content = `Mock response for: ${userMessage.slice(0, 120)}`;
    const usage = {
      promptTokens: Math.max(1, Math.ceil(userMessage.length / 4)),
      completionTokens: Math.max(1, Math.ceil(content.length / 4)),
      totalTokens: 0,
    };
    usage.totalTokens = usage.promptTokens + usage.completionTokens;

    return {
      content,
      usage,
      model: request.model,
      provider: this.name,
      latencyMs: Date.now() - started,
    };
  }

  async generateStructured<TSchema extends z.ZodTypeAny>(
    request: AIProviderStructuredRequest<TSchema>,
  ): Promise<AIProviderStructuredResponse<TSchema>> {
    const started = Date.now();
    let payload: Record<string, unknown>;

    if (request.schemaName === "diagnostics.structured") {
      payload = { ok: true, provider: "MOCK", latencyCategory: "fast" };
    } else if (request.schemaName === "content.ideas") {
      payload = {
        ideas: [
          {
            title: "Audience pain point spotlight",
            angle: "Address a key challenge your audience faces.",
            suggestedPlatforms: defaultPlatforms(),
            contentPillar: "Education",
          },
        ],
      };
    } else if (
      request.schemaName === "content.rewrite" ||
      request.schemaName === "content.transform" ||
      request.schemaName === "content.cta.improve"
    ) {
      payload = { result: "Improved brand-aligned copy.", notes: "Mock transform output." };
    } else if (request.schemaName === "content.hashtags") {
      payload = {
        hashtags: ["#marketing", "#brand", "#social"],
        rationale: "Relevant brand-safe hashtags.",
      };
    } else if (request.schemaName === "agent.platform_response") {
      payload = {
        summary: "Mock agent analysis completed using authorised internal data only.",
        analysis: ["Reviewed available tool outputs.", "No external providers were contacted."],
        recommendations: [
          {
            title: "Review data coverage",
            description: "Import or connect additional metrics before making budget decisions.",
            rationale: "Tool outputs may be incomplete for the selected scope.",
          },
        ],
        proposedActions: [],
        limitations: ["Mock provider response — validate against real data in production."],
        confidence: "MEDIUM",
      };
    } else if (request.schemaName.startsWith("content.")) {
      payload = mockSocialContent(request.schemaName);
    } else {
      payload = { ok: true, message: "mock structured response" };
    }

    const rawContent = JSON.stringify(payload);
    const data = aiResponseParser.parseStructured(
      {
        content: rawContent,
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        model: request.model,
        provider: this.name,
        latencyMs: 0,
      },
      request.schema,
    );

    return {
      data,
      rawContent,
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      model: request.model,
      provider: this.name,
      latencyMs: Date.now() - started,
    };
  }
}
