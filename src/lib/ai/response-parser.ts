import { createHash } from "node:crypto";
import type { z } from "zod";
import { AI_OUTPUT_PREVIEW_MAX_CHARS } from "@/lib/ai/constants";
import type { AIProviderTextResponse } from "@/lib/ai/types";

export class AIResponseParser {
  parseText(response: AIProviderTextResponse): string {
    return response.content.trim();
  }

  parseStructured<TSchema extends z.ZodTypeAny>(
    response: AIProviderTextResponse,
    schema: TSchema,
  ): z.infer<TSchema> {
    const jsonPayload = this.extractJsonPayload(response.content);
    const parsed = schema.safeParse(jsonPayload);
    if (!parsed.success) {
      throw new Error(
        `Structured output validation failed: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`,
      );
    }
    return parsed.data;
  }

  digest(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  preview(content: string): string {
    const trimmed = content.trim();
    if (trimmed.length <= AI_OUTPUT_PREVIEW_MAX_CHARS) return trimmed;
    return `${trimmed.slice(0, AI_OUTPUT_PREVIEW_MAX_CHARS)}…`;
  }

  private extractJsonPayload(content: string): unknown {
    const trimmed = content.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      const match = trimmed.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error("Provider response did not contain JSON.");
      }
      return JSON.parse(match[0]);
    }
  }
}

export const aiResponseParser = new AIResponseParser();
