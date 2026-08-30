// Runnable check for the Notification Center's failure translation (lib/notifications/humanize.ts).
// The load-bearing guarantee: a raw technical error / stack trace is NEVER shown to the user.
// node --experimental-strip-types scripts/check-notifications.ts
import assert from "node:assert/strict";
import { humanizeError } from "../lib/notifications/humanize.ts";

// Known technical failures map to plain-English what/why + a next step, with the right severity.
const credits = humanizeError("ScrapeCreators 402 for page 123");
assert.ok(/out of credits/i.test(credits.title) && credits.severity === "error", `402 -> out of credits, got ${JSON.stringify(credits)}`);
assert.ok(credits.action && /top up|meta ad library/i.test(credits.action), "402 gives a next step");

const verify = humanizeError('Meta Graph 403 on ads_archive: {"error":{"error_subcode":2332002}}');
assert.ok(/verification/i.test(verify.title) && verify.severity === "warning", `2332002 -> verification, got ${JSON.stringify(verify)}`);

const rate = humanizeError('Meta Graph 403: "Application request limit reached" subcode 1504022');
assert.ok(/rate-limit/i.test(rate.title) && rate.severity === "warning", `1504022 -> rate limit, got ${JSON.stringify(rate)}`);

const oauth = humanizeError("OAuthException: Error validating access token: token has expired");
assert.ok(/reconnect|re-authoriz/i.test((oauth.action ?? "") + oauth.title) && oauth.severity === "error", `oauth -> reconnect, got ${JSON.stringify(oauth)}`);

const ai = humanizeError("gemini 429 quota exceeded on generativelanguage");
assert.ok(/busy|ai/i.test(ai.title) && ai.severity === "warning", `gemini 429 -> AI busy, got ${JSON.stringify(ai)}`);

const meta = humanizeError("metadata: ad_meta upsert: duplicate key");
assert.ok(/didn't finish|detail/i.test(meta.title + meta.detail) && meta.severity === "warning", `metadata: -> partial, got ${JSON.stringify(meta)}`);

// THE SECURITY GUARANTEE: an unrecognized raw error/stack must NOT surface its text to the user.
const raw = "TypeError: Cannot read properties of undefined (reading 'brand_id') at from-store.ts:158:12";
const safe = humanizeError(raw, "syncing your account");
assert.ok(!safe.detail.includes("undefined") && !safe.detail.includes("from-store") && !safe.detail.includes(" at "), `unknown error must not leak the stack, got: ${safe.detail}`);
assert.ok(safe.title.length > 0 && safe.detail.length > 0, "unknown error still yields a safe title + detail");
assert.equal(safe.severity, "error", "unknown failure is an error");

console.log("PASS: notification failure-translation checks");
