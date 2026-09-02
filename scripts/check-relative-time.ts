// Runnable check for lib/relative-time.ts. Plain asserts. Run: npm run check:relative-time
import assert from "node:assert/strict";
import { relativeTime, daysSince } from "../lib/relative-time.ts";

const NOW = Date.parse("2026-09-03T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const M = 60_000, H = 3_600_000, D = 86_400_000;

assert.equal(relativeTime(null, NOW), null);
assert.equal(relativeTime("not-a-date", NOW), null);
assert.equal(relativeTime(ago(10_000), NOW), "just now");
assert.equal(relativeTime(ago(1 * M), NOW), "1 minute ago");
assert.equal(relativeTime(ago(5 * M), NOW), "5 minutes ago");
assert.equal(relativeTime(ago(1 * H), NOW), "1 hour ago");
assert.equal(relativeTime(ago(3 * H), NOW), "3 hours ago");
assert.equal(relativeTime(ago(1 * D), NOW), "1 day ago");
assert.equal(relativeTime(ago(5 * D), NOW), "5 days ago");
assert.equal(relativeTime(ago(29 * D), NOW), "29 days ago");
// Beyond 30 days -> absolute date, not "N days ago"
assert.ok(relativeTime(ago(45 * D), NOW)?.startsWith("on "), "old dates become absolute");
// future/clock-skew clamps to "just now", never negative
assert.equal(relativeTime(new Date(NOW + 5 * M).toISOString(), NOW), "just now");

assert.equal(daysSince(null, NOW), null);
assert.equal(daysSince(ago(0), NOW), 0);
assert.equal(daysSince(ago(3 * D + H), NOW), 3);

console.log("check-relative-time: OK");
