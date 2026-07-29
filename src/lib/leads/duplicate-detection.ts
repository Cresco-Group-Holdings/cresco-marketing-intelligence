import type { SocialProvider } from "@prisma/client";

export type DuplicateCandidate = {
  id: string;
  email?: string | null;
  phone?: string | null;
  providerUsername?: string | null;
  sourcePlatform?: SocialProvider | null;
};

export type DuplicateMatchInput = {
  email?: string | null;
  phone?: string | null;
  providerUsername?: string | null;
  sourcePlatform?: SocialProvider | null;
};

function normaliseEmail(email?: string | null): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalisePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

function normaliseUsername(username?: string | null): string | null {
  if (!username) return null;
  const trimmed = username.trim().replace(/^@/, "").toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function findDuplicateLead(
  candidates: DuplicateCandidate[],
  input: DuplicateMatchInput,
): DuplicateCandidate | null {
  const email = normaliseEmail(input.email);
  const phone = normalisePhone(input.phone);
  const username = normaliseUsername(input.providerUsername);
  const platform = input.sourcePlatform ?? null;

  for (const candidate of candidates) {
    const candidateEmail = normaliseEmail(candidate.email);
    if (email && candidateEmail && email === candidateEmail) {
      return candidate;
    }

    const candidatePhone = normalisePhone(candidate.phone);
    if (phone && candidatePhone && phone === candidatePhone) {
      return candidate;
    }

    const candidateUsername = normaliseUsername(candidate.providerUsername);
    if (
      username &&
      candidateUsername &&
      platform &&
      candidate.sourcePlatform === platform &&
      username === candidateUsername
    ) {
      return candidate;
    }
  }

  return null;
}
