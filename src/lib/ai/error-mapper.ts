import { AppError } from "@/lib/errors";
import type { AIProviderError } from "@/lib/ai/types";
import type { AIErrorCategory } from "@prisma/client";

export class AIErrorMapper {
  mapProviderError(error: AIProviderError): AppError {
    switch (error.category) {
      case "RATE_LIMIT":
        return new AppError("RATE_LIMITED", error.message);
      case "TIMEOUT":
        return new AppError("VALIDATION_ERROR", "AI request timed out.");
      case "CONFIGURATION_ERROR":
        return new AppError("AI_CONFIGURATION_REQUIRED", error.message);
      case "SAFETY_FILTER":
        return new AppError("VALIDATION_ERROR", "AI output was blocked by safety filters.");
      case "PROVIDER_ERROR":
      case "UNKNOWN":
      default:
        return new AppError("INTERNAL_ERROR", "AI provider request failed.", { expose: false });
    }
  }

  toErrorCategory(error: AIProviderError): AIErrorCategory {
    switch (error.category) {
      case "RATE_LIMIT":
        return "RATE_LIMIT";
      case "TIMEOUT":
        return "TIMEOUT";
      case "CONFIGURATION_ERROR":
        return "CONFIGURATION_ERROR";
      case "SAFETY_FILTER":
        return "SAFETY_FILTER";
      case "PROVIDER_ERROR":
        return "PROVIDER_ERROR";
      default:
        return "UNKNOWN";
    }
  }

  mapBudgetExceeded(): AppError {
    return new AppError("RATE_LIMITED", "AI usage budget exceeded for this tenant.");
  }

  mapValidationError(message: string): AppError {
    return new AppError("VALIDATION_ERROR", message);
  }

  mapConfigurationRequired(message?: string): AppError {
    return new AppError(
      "AI_CONFIGURATION_REQUIRED",
      message ??
        "AI provider is not configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_AI_API_KEY on the server.",
    );
  }
}

export const aiErrorMapper = new AIErrorMapper();
