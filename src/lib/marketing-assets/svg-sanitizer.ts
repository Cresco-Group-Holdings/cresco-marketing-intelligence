const DANGEROUS_SVG_PATTERNS = [
  /<script[\s>]/i,
  /on[a-z]+\s*=/i,
  /<foreignObject[\s>]/i,
  /javascript:/i,
  /data:text\/html/i,
  /<iframe[\s>]/i,
  /<embed[\s>]/i,
  /<object[\s>]/i,
  /<use[^>]+xlink:href\s*=\s*["'][^"']*javascript:/i,
];

export function sanitizeSvgContent(content: string): string {
  let sanitized = content.replace(/<\?xml[\s\S]*?\?>/gi, "").trim();

  for (const pattern of DANGEROUS_SVG_PATTERNS) {
    if (pattern.test(sanitized)) {
      throw new Error("SVG contains disallowed content.");
    }
  }

  sanitized = sanitized
    .replace(/\s(on[a-z]+)\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "")
    .replace(/xlink:href\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, "")
    .replace(/href\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, "");

  if (!/^<svg[\s>]/i.test(sanitized)) {
    throw new Error("SVG root element is invalid.");
  }

  return sanitized;
}
