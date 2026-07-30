export type StripeConfig = {
  secretKey: string;
  webhookSecret: string;
  apiVersion: string;
};

export function getStripeConfig(): StripeConfig | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secretKey || !webhookSecret) return null;
  return {
    secretKey,
    webhookSecret,
    apiVersion: process.env.STRIPE_API_VERSION?.trim() ?? "2024-11-20.acacia",
  };
}

export function isStripeConfigured(): boolean {
  return getStripeConfig() !== null;
}

export const DEFAULT_REPORTING_CURRENCY = "USD";
