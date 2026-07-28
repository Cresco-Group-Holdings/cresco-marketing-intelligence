import { createHash } from "node:crypto";
import { SENSITIVE_DATA_PATTERNS } from "@/lib/ai/constants";

export type RedactedText = {
  text: string;
  redacted: boolean;
  digest: string;
};

export interface SensitiveDataRedactor {
  redact(input: string): RedactedText;
}

export class DefaultSensitiveDataRedactor implements SensitiveDataRedactor {
  redact(input: string): RedactedText {
    let text = input;
    let redacted = false;

    for (const pattern of SENSITIVE_DATA_PATTERNS) {
      if (pattern.test(text)) {
        redacted = true;
        text = text.replace(pattern, "[REDACTED]");
      }
    }

    return {
      text,
      redacted,
      digest: createHash("sha256").update(text).digest("hex"),
    };
  }
}

export function createSensitiveDataRedactor(): SensitiveDataRedactor {
  return new DefaultSensitiveDataRedactor();
}
