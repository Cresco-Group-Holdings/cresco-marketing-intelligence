/** Parse @userId mentions from comment body. Only organisation-scoped user IDs are valid. */
const MENTION_PATTERN = /@([a-zA-Z0-9_-]{20,})/g;

export function parseMentionedUserIds(body: string): string[] {
  const matches = body.matchAll(MENTION_PATTERN);
  const ids = new Set<string>();
  for (const match of matches) {
    const id = match[1];
    if (id) ids.add(id);
  }
  return [...ids];
}

export function sanitizeCommentBody(body: string): string {
  return body
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/javascript:/gi, "")
    .trim()
    .slice(0, 10_000);
}

export function renderSafeMarkdown(body: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br />");
}
