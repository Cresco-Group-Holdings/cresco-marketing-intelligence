import type { CrmContactMethodType } from "@prisma/client";

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 ? digits : "";
}

export function normaliseContactValue(methodType: CrmContactMethodType | string, value: string): string {
  switch (methodType) {
    case "EMAIL":
      return normaliseEmail(value);
    case "PHONE":
    case "MOBILE":
      return normalisePhone(value);
    case "LINKEDIN":
      return value.trim().toLowerCase().replace(/^@/, "");
    default:
      return value.trim();
  }
}

export function isValidContactValue(methodType: CrmContactMethodType | string, value: string): boolean {
  const normalised = normaliseContactValue(methodType, value);
  if (!normalised) return false;
  if (methodType === "EMAIL") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised);
  if (methodType === "PHONE" || methodType === "MOBILE") return normalised.length >= 7;
  return normalised.length > 0;
}
