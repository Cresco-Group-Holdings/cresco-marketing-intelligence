import type { CopilotModule } from "@/lib/copilot/types";

const STARTERS: Record<CopilotModule, string[]> = {
  dashboard: [
    "What are the five most important things I should do today?",
    "Give me today's marketing brief.",
    "What changed in the last 30 days?",
  ],
  advertising: [
    "Why did ROAS change?",
    "Where is budget underperforming?",
    "Which creative needs attention?",
  ],
  social: [
    "What should I publish next?",
    "Which format is growing fastest?",
    "What should I repurpose?",
  ],
  content: [
    "What content should become an ad?",
    "Which paid creative should become organic content?",
    "What should we publish next week?",
  ],
  analytics: [
    "Which channel drives revenue?",
    "What is our attribution coverage?",
    "Which content assists conversions?",
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
