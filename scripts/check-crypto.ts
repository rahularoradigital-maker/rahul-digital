// Runnable check for lib/crypto.ts. No env needed (uses an ephemeral key).
//   npm run check:crypto
import { strict as assert } from "node:assert";
import { encryptToken, decryptToken, generateKey } from "../lib/crypto.ts";

const key = Buffer.from(generateKey(), "base64");
const secret = "EAAB_sample_meta_oauth_token_9f8e7d";

// round trip
const enc = encryptToken(secret, key);
assert.notEqual(enc, secret, "ciphertext must differ from plaintext");
assert.equal(decryptToken(enc, key), secret, "round trip must recover the token");

// random IV -> different ciphertext each call
assert.notEqual(encryptToken(secret, key), encryptToken(secret, key), "IV must randomize output");

// tamper detection (flip last chars of ciphertext)
const tampered = enc.slice(0, -2) + (enc.endsWith("A") ? "BB" : "AA");
assert.throws(() => decryptToken(tampered, key), "tampered payload must fail auth");

// wrong key fails
const otherKey = Buffer.from(generateKey(), "base64");
assert.throws(() => decryptToken(enc, otherKey), "wrong key must fail");

console.log("PASS: crypto round-trip, IV uniqueness, tamper, and wrong-key checks");
