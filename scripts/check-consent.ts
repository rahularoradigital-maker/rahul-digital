// Cookie-consent normalizer (lib/analytics/consent.ts). No DOM. Proves only valid choices are honoured and
// anything else is treated as "undecided" (so GA never loads on a garbage/absent value - fail-safe).
// Run: node --experimental-strip-types scripts/check-consent.ts
import assert from "node:assert/strict";
import { normalizeConsent } from "../lib/analytics/consent.ts";

assert.equal(normalizeConsent("granted"), "granted", "granted honoured");
assert.equal(normalizeConsent("denied"), "denied", "denied honoured");
assert.equal(normalizeConsent(null), null, "absent -> undecided");
assert.equal(normalizeConsent(undefined), null, "undefined -> undecided");
assert.equal(normalizeConsent(""), null, "empty -> undecided");
assert.equal(normalizeConsent("GRANTED"), null, "case-sensitive: not a valid value");
assert.equal(normalizeConsent("true"), null, "garbage -> undecided (GA stays off)");

console.log("PASS: cookie consent normalizer (only granted/denied honoured; anything else = undecided, GA off)");
