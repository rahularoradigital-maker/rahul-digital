// Runnable check for the copy policy-lint (lib/creative-production/qa/policy-lint.ts). No I/O.
// node --experimental-strip-types scripts/check-cp-policy-lint.ts
import assert from "node:assert/strict";
import { lintAdCopy, lintCopyField } from "../lib/creative-production/qa/policy-lint.ts";

// Clean copy -> no findings (the common case; lint must not cry wolf).
assert.deepEqual(lintAdCopy({ headline: "Comfort that lasts all day", supportingCopy: "Soft, breathable, 30-day returns.", cta: "Shop now", offer: "20% off" }), [], "clean copy passes");

// Personal attributes.
const pa = lintCopyField("Are you overweight? Try this.", "headline");
assert.equal(pa.length, 1);
assert.equal(pa[0].area, "personal-attributes");

// Before/after + numeric loss.
assert.equal(lintCopyField("See the before and after", "headline")[0].area, "before-after");
assert.equal(lintCopyField("Lose 10 kg in a month", "headline")[0].area, "before-after");

// Unproven claims / superlatives.
assert.equal(lintCopyField("100% guaranteed results", "body")[0].area, "unproven-claim");
assert.equal(lintCopyField("The #1 best-selling kurta", "headline")[0].area, "unproven-claim");
assert.equal(lintCopyField("This cream cures acne", "body")[0].area, "unproven-claim");

// Sensational.
assert.equal(lintCopyField("A miracle you won't believe", "headline")[0].area, "sensational");

// Findings carry a phrase + a fix (actionable, not just a flag).
const f = lintCopyField("Are you in debt?", "headline")[0];
assert.ok(f.phrase && f.fix && f.why, "finding has phrase, fix and why");
assert.equal(f.where, "headline");

// Multiple fields aggregate.
const multi = lintAdCopy({ headline: "The #1 cream", supportingCopy: "Cure your acne", cta: "Buy", offer: null });
assert.ok(multi.length >= 2, "flags across headline + body");

console.log("PASS: copy policy-lint (clean passes; personal/before-after/unproven/sensational flagged with fixes)");
