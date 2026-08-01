import { getServerEnv } from "@/lib/environment";

export function isResendProviderEnabled(): boolean {
  const env = getServerEnv();
  return env.RESEND_PROVIDER_ENABLED === "true";
}

export function isEmailEmergencyShutdownEnabled(): boolean {
  const env = getServerEnv();
  return env.EMAIL_EMERGENCY_SHUTDOWN === "true";
}
