export type SpamSignal = {
  type: string;
  detail: string;
  weight: number;
};

export type SpamAssessmentInput = {
  honeypotFilled?: boolean;
  duplicateSubmission?: boolean;
  originMismatch?: boolean;
  velocityExceeded?: boolean;
  botSignals?: string[];
  payloadAnomaly?: boolean;
};

export function assessSpam(input: SpamAssessmentInput): {
  verdict: "CLEAN" | "SUSPICIOUS" | "QUARANTINED";
  signals: SpamSignal[];
  score: number;
} {
  const signals: SpamSignal[] = [];
  let score = 0;

  if (input.honeypotFilled) {
    signals.push({ type: "honeypot", detail: "Honeypot field filled", weight: 100 });
    score += 100;
  }
  if (input.duplicateSubmission) {
    signals.push({ type: "duplicate", detail: "Duplicate idempotency key", weight: 80 });
    score += 80;
  }
  if (input.originMismatch) {
    signals.push({ type: "origin", detail: "Origin not in allowlist", weight: 60 });
    score += 60;
  }
  if (input.velocityExceeded) {
    signals.push({ type: "velocity", detail: "Submission velocity exceeded", weight: 50 });
    score += 50;
  }
  if (input.botSignals?.length) {
    signals.push({ type: "bot", detail: input.botSignals.join(", "), weight: 40 });
    score += 40;
  }
  if (input.payloadAnomaly) {
    signals.push({ type: "payload", detail: "Payload anomaly detected", weight: 30 });
    score += 30;
  }

  let verdict: "CLEAN" | "SUSPICIOUS" | "QUARANTINED" = "CLEAN";
  if (score >= 80) verdict = "QUARANTINED";
  else if (score >= 30) verdict = "SUSPICIOUS";

  return { verdict, signals, score };
}
