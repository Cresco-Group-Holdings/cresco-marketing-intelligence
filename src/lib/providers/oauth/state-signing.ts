import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/lib/environment";
import { PROVIDER_OAUTH_STATE_TTL_MS } from "@/lib/providers/constants";

export type SignedOAuthStatePayload = {
  organisationId: string;
  providerKey: string;
  connectionId?: string;
  returnUrl?: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
};

function getSigningKey(): string {
  const env = getServerEnv();
  return env.OAUTH_STATE_SIGNING_KEY ?? env.ENCRYPTION_KEY;
}

export function signOAuthStatePayload(payload: SignedOAuthStatePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSigningKey()).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifySignedOAuthStatePayload(signed: string): SignedOAuthStatePayload {
  const [body, signature] = signed.split(".");
  if (!body || !signature) {
    throw new Error("Invalid OAuth state signature format.");
  }

  const expected = createHmac("sha256", getSigningKey()).update(body).digest("base64url");
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw new Error("OAuth state signature verification failed.");
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedOAuthStatePayload;

  if (payload.expiresAt < Date.now()) {
    throw new Error("OAuth state has expired.");
  }

  return payload;
}

export function createSignedOAuthStatePayload(input: {
  organisationId: string;
  providerKey: string;
  connectionId?: string;
  returnUrl?: string;
  nonce: string;
}): { payload: SignedOAuthStatePayload; signed: string } {
  const issuedAt = Date.now();
  const payload: SignedOAuthStatePayload = {
    ...input,
    issuedAt,
    expiresAt: issuedAt + PROVIDER_OAUTH_STATE_TTL_MS,
  };
  return { payload, signed: signOAuthStatePayload(payload) };
}
