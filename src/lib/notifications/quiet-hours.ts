export function isWithinQuietHours(input: {
  now?: Date;
  timezone?: string | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}): boolean {
  const { quietHoursStart, quietHoursEnd } = input;
  if (!quietHoursStart || !quietHoursEnd) {
    return false;
  }

  const now = input.now ?? new Date();
  const tz = input.timezone ?? "UTC";
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const currentMinutes = hour * 60 + minute;

  const [startH, startM] = quietHoursStart.split(":").map(Number);
  const [endH, endM] = quietHoursEnd.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}
