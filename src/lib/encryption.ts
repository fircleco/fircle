import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_IV_BYTES = 12;
const ENCRYPTION_AUTH_TAG_BYTES = 16;

type EncryptionEnvelope = {
  v: 1;
  iv: string;
  tag: string;
  ciphertext: string;
};

function toEncryptionKey(masterKey: string | Buffer): Buffer {
  if (Buffer.isBuffer(masterKey)) {
    if (masterKey.length === 32) {
      return masterKey;
    }

    return createHash("sha256").update(masterKey).digest();
  }

  return createHash("sha256").update(masterKey).digest();
}

export function encryptCredentials(payload: unknown, masterKey: string | Buffer): string {
  const key = toEncryptionKey(masterKey);
  const iv = randomBytes(ENCRYPTION_IV_BYTES);

  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const envelope: EncryptionEnvelope = {
    v: 1,
    iv: iv.toString("base64url"),
    tag: tag.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };

  return JSON.stringify(envelope);
}

export function decryptCredentials<T = unknown>(encryptedPayload: string, masterKey: string | Buffer): T {
  const key = toEncryptionKey(masterKey);
  const parsed = JSON.parse(encryptedPayload) as EncryptionEnvelope;

  if (parsed.v !== 1) {
    throw new Error(`Unsupported encrypted payload version: ${String(parsed.v)}`);
  }

  const iv = Buffer.from(parsed.iv, "base64url");
  const tag = Buffer.from(parsed.tag, "base64url");
  const ciphertext = Buffer.from(parsed.ciphertext, "base64url");

  if (iv.length !== ENCRYPTION_IV_BYTES) {
    throw new Error("Invalid encrypted payload initialization vector length");
  }

  if (tag.length !== ENCRYPTION_AUTH_TAG_BYTES) {
    throw new Error("Invalid encrypted payload authentication tag length");
  }

  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
