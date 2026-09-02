// Runnable check for platform-aware QA (qa/platform-checks.ts). No I/O.
// node --experimental-strip-types scripts/check-cp-platform-checks.ts
import assert from "node:assert/strict";
import { checkCharLimits, checkMinFont, checkSafeZone } from "../lib/creative-production/qa/platform-checks.ts";

// Char limits: within limits -> no findings; over -> a truncation warning.
assert.deepEqual(checkCharLimits({ headline: "Short and sweet", primary: "A clean line." }, "meta_feed"), [], "within limits passes");
const over = checkCharLimits({ headline: "x".repeat(60), primary: "y".repeat(200) }, "meta_feed");
assert.equal(over.length, 2, "both headline + body flagged");
assert.ok(over.every((c) => !c.pass && c.severity === "warning"));
// Google RSA has tighter headline (30).
assert.equal(checkCharLimits({ headline: "x".repeat(35) }, "google_rsa").length, 1, "35-char headline > RSA 30");
assert.equal(checkCharLimits({ headline: "x".repeat(35) }, "meta_feed").length, 0, "35 is fine on Meta (40)");

// Min font: a 24px title on a 1920 canvas shown at 640 -> 8px -> critical fail.
const tiny = checkMinFont(24, 1920, 640);
assert.equal(tiny.pass, false);
assert.equal(tiny.severity, "critical");
// A 48px title -> 16px on a phone -> legible.
assert.equal(checkMinFont(48, 1920, 640).pass, true);

// Safe zone: vertical placement with text near the bottom -> clipped; centered text -> fine.
assert.equal(checkSafeZone(0.4, 0.6, "meta_reel").pass, true, "centered text is safe");
assert.equal(checkSafeZone(0.85, 0.95, "meta_story").pass, false, "bottom text hidden behind story UI");
assert.equal(checkSafeZone(0.02, 0.1, "meta_story").pass, false, "top text behind the profile row");
assert.equal(checkSafeZone(0.85, 0.95, "meta_feed").pass, true, "non-vertical placement has no safe-zone issue");

console.log("PASS: platform-checks (char limits per placement, min mobile font, story/reel safe zone)");
