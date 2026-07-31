const UNSAFE_TAGS = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const EVENT_HANDLERS = /\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JAVASCRIPT_URLS = /javascript\s*:/gi;

export function sanitiseEmailHtml(html: string): { sanitised: string; blocked: string[] } {
  const blocked: string[] = [];
  let sanitised = html;

  if (UNSAFE_TAGS.test(html)) {
    blocked.push("script tags");
    sanitised = sanitised.replace(UNSAFE_TAGS, "");
  }
  if (EVENT_HANDLERS.test(html)) {
    blocked.push("inline event handlers");
    sanitised = sanitised.replace(EVENT_HANDLERS, "");
  }
  if (JAVASCRIPT_URLS.test(html)) {
    blocked.push("javascript: URLs");
    sanitised = sanitised.replace(JAVASCRIPT_URLS, "");
  }

  return { sanitised, blocked };
}

export function requiresComplianceFooter(category: string): boolean {
  return ["MARKETING", "NURTURE", "NEWSLETTER", "EVENT"].includes(category);
}
