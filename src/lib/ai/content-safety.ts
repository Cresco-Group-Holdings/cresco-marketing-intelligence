import type { SocialContentOutput } from "@/lib/ai/content-output-schemas";

export type ContentSafetyFlag = {
  code: string;
  message: string;
  severity: "warning" | "critical";
  requiresReview: boolean;
};

const SAFETY_PATTERNS: Array<{
  code: string;
  pattern: RegExp;
  message: string;
  severity: "warning" | "critical";
}> = [
  {
    code: "FINANCIAL_GUARANTEE",
    pattern: /\b(guaranteed returns?|risk[- ]free|100% profit|get rich)\b/i,
    message: "Output may contain unsupported financial guarantees.",
    severity: "critical",
  },
  {
    code: "FABRICATED_GRANT",
    pattern: /\b(guaranteed grant|everyone qualifies|free money from government)\b/i,
    message: "Output may fabricate grant availability.",
    severity: "critical",
  },
  {
    code: "FABRICATED_RESULTS",
    pattern: /\b(\d{2,3}% (increase|growth|roi)|clients? saw \d+%)\b/i,
    message: "Output may contain unverified performance claims.",
    severity: "warning",
  },
  {
    code: "FAKE_TESTIMONIAL",
    pattern: /\b(as a customer|i saved \d+|client testimonial)\b/i,
    message: "Output may imply a fabricated testimonial.",
    severity: "critical",
  },
  {
    code: "IMPERSONATION",
    pattern: /\b(official account of|speaking on behalf of (google|meta|government))\b/i,
    message: "Output may impersonate another entity.",
    severity: "critical",
  },
  {
    code: "DISCRIMINATION",
    pattern: /\b(only for (men|women|whites?|blacks?)|exclude (women|men))\b/i,
    message: "Output may contain discriminatory language.",
    severity: "critical",
  },
];

export function scanContentSafety(text: string): ContentSafetyFlag[] {
  const flags: ContentSafetyFlag[] = [];
  for (const rule of SAFETY_PATTERNS) {
    if (rule.pattern.test(text)) {
      flags.push({
        code: rule.code,
        message: rule.message,
        severity: rule.severity,
        requiresReview: rule.severity === "critical",
      });
    }
  }
  return flags;
}

export function scanGeneratedContent(output: SocialContentOutput): ContentSafetyFlag[] {
  const combined = [
    output.hook,
    output.body,
    output.caption,
    output.headline ?? "",
    output.cta,
    output.videoScript ?? "",
    ...(output.platformAdaptations?.map((item) => item.caption) ?? []),
  ].join("\n");

  const flags = scanContentSafety(combined);
  for (const modelFlag of output.safetyFlags ?? []) {
    flags.push({
      code: "MODEL_FLAG",
      message: modelFlag,
      severity: "warning",
      requiresReview: true,
    });
  }

  const unique = new Map(flags.map((flag) => [flag.code, flag]));
  return [...unique.values()];
}

export function hasCriticalSafetyFlags(flags: ContentSafetyFlag[]): boolean {
  return flags.some((flag) => flag.severity === "critical");
}
