// Runnable check for the SSRF guard (lib/ssrf.ts). The load-bearing guarantee: private/loopback/link-local
// hosts and non-https URLs are rejected before any server-side fetch of an external ad/image URL.
// node --experimental-strip-types scripts/check-ssrf.ts
import assert from "node:assert/strict";
import { isPrivateIp, urlIsSyntacticallyUnsafe } from "../lib/ssrf.ts";

// Private / dangerous IP ranges must be flagged private.
for (const ip of ["10.0.0.1", "127.0.0.1", "169.254.169.254", "172.16.5.5", "172.31.255.1", "192.168.1.1", "100.64.0.1", "0.0.0.0", "::1", "fc00::1", "fd12::1", "fe80::1", "::ffff:127.0.0.1"]) {
  assert.equal(isPrivateIp(ip), true, `${ip} must be private`);
}
// Public IPs must NOT be flagged private.
for (const ip of ["8.8.8.8", "1.1.1.1", "157.240.221.35", "23.45.67.89", "2606:4700:4700::1111"]) {
  assert.equal(isPrivateIp(ip), false, `${ip} must be public`);
}
// 172.15/172.32 are OUTSIDE the private 172.16-31 block.
assert.equal(isPrivateIp("172.15.0.1"), false, "172.15 is public");
assert.equal(isPrivateIp("172.32.0.1"), false, "172.32 is public");

// URL-level syntactic guard: reject non-https, localhost, metadata, and private IP literals.
for (const bad of [
  "http://example.com/x.jpg", // not https
  "https://localhost/x", "https://foo.localhost/x",
  "https://169.254.169.254/latest/meta-data/", // cloud metadata
  "https://127.0.0.1/x", "https://10.1.2.3/x", "https://192.168.0.5/x",
  "https://metadata.google.internal/x",
  "ftp://example.com/x", "not-a-url",
]) {
  assert.equal(urlIsSyntacticallyUnsafe(bad), true, `must reject: ${bad}`);
}
// Legit public https ad/CDN URLs pass the syntactic gate (DNS check happens separately, live).
for (const ok of ["https://scontent.xx.fbcdn.net/v/x.jpg", "https://cdn.shopify.com/s/files/x.png", "https://8.8.8.8/x"]) {
  assert.equal(urlIsSyntacticallyUnsafe(ok), false, `must allow: ${ok}`);
}

console.log("PASS: SSRF guard (private-range detection + https/host syntactic gate)");
