const SECRET_PATTERNS = [
  /\bBearer\s+\S+/gi,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /\b(?:sk|pk)_[A-Za-z0-9]{10,}\b/g,
  /\bpassword\s*[:=]\s*\S+/gi,
  /\bapi[_-]?key\s*[:=]\s*\S+/gi,
  /\baccess[_-]?token\s*[:=]\s*\S+/gi,
  /\brefresh[_-]?token\s*[:=]\s*\S+/gi,
];

export function sanitiseEmailBody(input: string): string {
  let output = input;
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, "[redacted]");
  }
  return output;
}

export function buildSafeInternalLink(path: string, appOrigin?: string): string {
  const origin = appOrigin ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://app.cresco.test";
  if (!path.startsWith("/")) {
    return `${origin}/dashboard`;
  }
  return `${origin}${path}`;
}

export type SafeEmailPayload = {
  subject: string;
  body: string;
  organisationName: string;
  unsubscribeUrl?: string;
  actionUrl?: string;
};

export function buildSafeEmailPayload(input: {
  subject: string;
  body: string;
  organisationName: string;
  actionPath?: string;
  allowUnsubscribe?: boolean;
  userId?: string;
  organisationId?: string;
}): SafeEmailPayload {
  const actionUrl = input.actionPath ? buildSafeInternalLink(input.actionPath) : undefined;
  const unsubscribeUrl =
    input.allowUnsubscribe && input.userId && input.organisationId
      ? buildSafeInternalLink(
          `/settings/notifications?organisationId=${input.organisationId}&unsubscribe=1`,
        )
      : undefined;

  return {
    subject: sanitiseEmailBody(input.subject),
    body: sanitiseEmailBody(input.body),
    organisationName: input.organisationName,
    actionUrl,
    unsubscribeUrl,
  };
}

/** Social message bodies must not appear in email by default. */
export function stripSensitiveSocialContent(body: string): string {
  if (body.length > 200) {
    return "You have a new social interaction requiring attention. Open the inbox to review.";
  }
  return sanitiseEmailBody(body);
}
