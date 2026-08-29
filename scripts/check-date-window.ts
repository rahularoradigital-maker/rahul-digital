// Runnable check for lib/date-window.ts (ISSUE 29). No env needed.
//   node --experimental-strip-types scripts/check-date-window.ts
// A UTC instant that falls on a DIFFERENT calendar day in the account timezone must produce the
// account-timezone date, not the UTC date - that boundary is the whole point of the fix.
import { strict as assert } from "node:assert";
import { todayIn, daysAgo, calendarDate } from "../lib/date-window.ts";

// 2026-03-15 20:00 UTC == 2026-03-16 01:30 IST (Asia/Kolkata, +5:30). UTC day and IST day differ.
const nightUTC = new Date("2026-03-15T20:00:00Z");
assert.equal(todayIn("Asia/Kolkata", nightUTC), "2026-03-16", "IST calendar day (next day)");
assert.equal(todayIn(null, nightUTC), "2026-03-15", "UTC calendar day");
assert.equal(todayIn("Europe/London", nightUTC), "2026-03-15", "London day");

// N-days-ago counts back from the account-timezone 'today'.
assert.equal(daysAgo(7, "Asia/Kolkata", nightUTC), "2026-03-09", "7d ago in IST");
assert.equal(daysAgo(0, "Asia/Kolkata", nightUTC), "2026-03-16", "0d ago == today");
assert.equal(daysAgo(14, null, nightUTC), "2026-03-01", "14d ago in UTC");

// DST-safe: subtracting across a spring-forward day still lands on the right calendar date.
// 2026-03-09 is the day after US DST start; count back over it in a US zone.
assert.equal(calendarDate("America/New_York", 3, new Date("2026-03-10T12:00:00Z")), "2026-03-07", "DST-safe subtraction");

// null tz behaves exactly like the old UTC daysAgo (no behavior change when timezone is unknown).
assert.equal(daysAgo(30, null, new Date("2026-08-29T06:00:00Z")), "2026-07-30", "null tz == UTC");

console.log("PASS: date windows are computed in the account timezone (UTC fallback, DST-safe)");
