import { createHash } from "node:crypto";
import { createSensitiveDataRedactor } from "@/lib/ai/redaction";

const redactor = createSensitiveDataRedactor();

export function redactAgentPayload<T extends Record<string, unknown>>(payload: T): T {
  const serialised = JSON.stringify(payload);
  const result = redactor.redact(serialised);
  return JSON.parse(result.text) as T;
}

export function redactAgentText(text: string): string {
  return redactor.redact(text).text;
}

export function digestAgentText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
