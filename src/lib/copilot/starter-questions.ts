import type { CopilotModule } from "@/lib/copilot/types";

const STARTERS: Record<CopilotModule, string[]> = {
  dashboard: [
    "What are the five most important things I should do today?",
    "Give me today's marketing brief.",
    "What changed in the last 30 days?",
  ],
  advertising: [
    "Why did ROAS change?",
    "Which campaigns need attention?",
    "Where is budget inefficient?",
  ],
  social: [
    "What should I publish next?",
    "What should I repurpose?",
    "Which format performs best?",
  ],
  content: [
    "What content should become an ad?",
    "Which paid creative should become organic content?",
    "What should we publish next week?",
  ],
  analytics: [
    "Which content drives revenue?",
    "What is attribution coverage?",
    "Why did conversions decline?",
  ],
  calendar: [
    "Are there publishing gaps this week?",
    "What should I schedule next?",
  ],
  copilot: [
    "Give me today's marketing brief.",
    "What are today's top priorities?",
    "Can I trust these numbers?",
  ],
  other: [
    "What changed in the last 30 days?",
    "What should I focus on today?",
    "Can I trust these numbers?",
  ],
};

export function getStarterQuestions(module: CopilotModule): string[] {
  return STARTERS[module] ?? STARTERS.other;
}
