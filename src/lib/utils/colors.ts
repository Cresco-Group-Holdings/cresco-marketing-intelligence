const HEX_COLOUR_PATTERN = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

export function isValidHexColour(value: string | null | undefined): boolean {
  if (!value) {
    return true;
  }

  return HEX_COLOUR_PATTERN.test(value.trim());
}

export function normaliseHexColour(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  return trimmed.toUpperCase();
}
