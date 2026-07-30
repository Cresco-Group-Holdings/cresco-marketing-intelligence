import { KNOWN_BOT_PATTERNS, TRACKING_RATE_LIMIT_PER_MINUTE } from "@/lib/tracking/constants";

export type BotFilterInput = {
  userAgent?: string | null;
  origin?: string | null;
  eventsPerMinute?: number;
  isDuplicateBurst?: boolean;
  isInternalTraffic?: boolean;
};

export type BotFilterResult = {
  quarantine: boolean;
  reason?: string;
};

export function evaluateBotSignals(input: BotFilterInput): BotFilterResult {
  const userAgent = input.userAgent?.trim() ?? "";

  if (!userAgent) {
    return { quarantine: true, reason: "missing_user_agent" };
  }

  for (const pattern of KNOWN_BOT_PATTERNS) {
    if (pattern.test(userAgent)) {
      return { quarantine: true, reason: "known_bot_user_agent" };
    }
  }

  if ((input.eventsPerMinute ?? 0) > TRACKING_RATE_LIMIT_PER_MINUTE * 2) {
    return { quarantine: true, reason: "impossible_event_frequency" };
  }

  if (input.isDuplicateBurst) {
    return { quarantine: true, reason: "duplicate_event_burst" };
  }

  if (input.isInternalTraffic) {
    return { quarantine: true, reason: "internal_traffic" };
  }

  if (!input.origin) {
    return { quarantine: true, reason: "missing_origin" };
  }

  return { quarantine: false };
}
