import "server-only"; // compile-time tripwire: TOKEN_ENC_KEY code path must never reach the client
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

// AES-256-GCM envelope encryption for OAuth tokens at rest (see ADR-0002).
// Server-only. The master key lives in TOKEN_ENC_KEY (base64, 32 bytes) and never
// reaches the browser. Payload format: "v1.<iv>.<tag>.<ciphertext>", all base64.

const ALGO = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;

function getKey(): Buffer {
  const b64 = process.env.TOKEN_ENC_KEY;
  if (!b64) throw new Error("TOKEN_ENC_KEY is not set");
  const key = Buffer.from(b64, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(`TOKEN_ENC_KEY must decode to ${KEY_BYTES} bytes (got ${key.length})`);
  }
  return key;
}

/** Encrypt a token string. `key` is injectable for tests; defaults to TOKEN_ENC_KEY. */
export function encryptToken(plaintext: string, key: Buffer = getKey()): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(".");
}

/** Decrypt a payload from encryptToken. Throws if malformed, tampered, or wrong key. */
export function decryptToken(payload: string, key: Buffer = getKey()): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("malformed token payload");
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Generate a fresh base64 TOKEN_ENC_KEY (setup helper). */
export function generateKey(): string {
  return randomBytes(KEY_BYTES).toString("base64");
}
