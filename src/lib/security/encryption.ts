import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { getServerEnv } from "@/lib/environment";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const CURRENT_KEY_VERSION = 1;

type KeyMaterial = {
  version: number;
  key: Buffer;
};

function deriveKey(secret: string, version: number): Buffer {
  return scryptSync(secret, `cresco-connector-v${version}`, 32);
}

function getKeyMaterial(version = CURRENT_KEY_VERSION): KeyMaterial {
  const secret = getServerEnv().ENCRYPTION_KEY;
  return {
    version,
    key: deriveKey(secret, version),
  };
}

export function encryptSecret(plaintext: string, keyVersion = CURRENT_KEY_VERSION): string {
  const { key } = getKeyMaterial(keyVersion);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    `v${keyVersion}`,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSecret(payload: string): string {
  const [versionToken, ivToken, authTagToken, ciphertextToken] = payload.split(":");
  if (!versionToken || !ivToken || !authTagToken || !ciphertextToken) {
    throw new Error("Invalid encrypted payload format.");
  }

  const version = Number(versionToken.replace(/^v/, ""));
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("Unsupported encryption key version.");
  }

  const { key } = getKeyMaterial(version);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivToken, "base64url"));
  decipher.setAuthTag(Buffer.from(authTagToken, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertextToken, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function getCurrentEncryptionKeyVersion(): number {
  return CURRENT_KEY_VERSION;
}

export function rotateEncryptedSecret(payload: string): string {
  const plaintext = decryptSecret(payload);
  return encryptSecret(plaintext, CURRENT_KEY_VERSION);
}
