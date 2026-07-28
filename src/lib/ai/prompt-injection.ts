import { PROMPT_INJECTION_PATTERNS } from "@/lib/ai/constants";

export function detectPromptInjection(input: string): boolean {
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

export function sanitiseUserInput(input: string): string {
  return input.replace(/\0/g, "").trim();
}
