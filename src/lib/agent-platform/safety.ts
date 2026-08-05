import { detectPromptInjection, sanitiseUserInput } from "@/lib/ai/prompt-injection";
import { createSensitiveDataRedactor } from "@/lib/ai/redaction";
import { HIGH_IMPACT_ACTION_KEYS } from "@/lib/agent-platform/constants";

export type AgentSafetyResult = {
  passed: boolean;
  sanitisedInput: string;
  warnings: string[];
  blocked: boolean;
  blockReasons: string[];
};

const redactor = createSensitiveDataRedactor();

export function evaluateAgentInputSafety(userInput: string): AgentSafetyResult {
  const warnings: string[] = [];
  const blockReasons: string[] = [];

  const sanitisedInput = sanitiseUserInput(userInput);
  const injectionDetected = detectPromptInjection(sanitisedInput);
  if (injectionDetected) {
    blockReasons.push("Prompt injection pattern detected in user input.");
    warnings.push("Potential prompt injection detected.");
  }

  const redacted = redactor.redact(sanitisedInput);
  if (redacted.redacted) {
    warnings.push("Sensitive values were redacted from user input.");
  }

  return {
    passed: blockReasons.length === 0,
    sanitisedInput: redacted.text,
    warnings,
    blocked: blockReasons.length > 0,
    blockReasons,
  };
}

export function evaluateAgentOutputSafety(output: string): AgentSafetyResult {
  const warnings: string[] = [];
  const blockReasons: string[] = [];
  const redacted = redactor.redact(output);

  if (redacted.redacted) {
    warnings.push("Sensitive values were redacted from model output.");
  }

  if (containsSecretPatterns(redacted.text)) {
    blockReasons.push("Model output may contain secrets and was blocked.");
  }

  return {
    passed: blockReasons.length === 0,
    sanitisedInput: redacted.text,
    warnings,
    blocked: blockReasons.length > 0,
    blockReasons,
  };
}

export function classifyProposedActionRisk(actionKey: string): "DRAFT" | "HIGH_IMPACT" {
  return HIGH_IMPACT_ACTION_KEYS.has(actionKey) ? "HIGH_IMPACT" : "DRAFT";
}

function containsSecretPatterns(text: string): boolean {
  const patterns = [
    /sk-[a-zA-Z0-9]{10,}/,
    /api[_-]?key\s*[:=]\s*['"]?[a-zA-Z0-9_-]{16,}/i,
    /Bearer\s+[a-zA-Z0-9._-]{20,}/,
  ];
  return patterns.some((pattern) => pattern.test(text));
}
