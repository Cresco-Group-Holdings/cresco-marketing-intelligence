/** MOCK AI is permitted only in automated tests, E2E harness, or explicit local development mode. */
export function isMockAiAllowed(): boolean {
  if (process.env.NODE_ENV === "test") return true;
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.CRESCO_E2E_HARNESS === "true") return true;
  return process.env.AI_ALLOW_MOCK === "true";
}

export function assertMockAiAllowed(): void {
  if (!isMockAiAllowed()) {
    throw new Error("Mock AI provider is not permitted in this environment.");
  }
}
