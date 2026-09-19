// Runnable check for lib/glossary/autolink.ts. node:assert strict, prints one PASS line.
// Run: node --experimental-strip-types scripts/check-autolink.ts
import assert from "node:assert/strict";
import { autolinkTerms } from "../lib/glossary/autolink.ts";

// First occurrence links; the second mention of the same term is left plain (no spammy over-linking).
const a = autolinkTerms("Your ROAS matters. A high ROAS is good.");
assert.equal(a, "Your [ROAS](/glossary/roas) matters. A high ROAS is good.", "only first ROAS links");

// Longest term wins: 'Target ROAS' links to target-roas, NOT nested with roas.
const b = autolinkTerms("Move to Target ROAS when ready.");
assert.equal(b, "Move to [Target ROAS](/glossary/target-roas) when ready.", "longest match wins, no nesting");
assert.ok(!b.includes("[Target [ROAS]"), "no nested link");

// Headings are never linked.
const c = autolinkTerms("## What is ROAS\nYour ROAS is a ratio.");
assert.equal(c.split("\n")[0], "## What is ROAS", "heading untouched");
assert.ok(c.split("\n")[1].includes("[ROAS](/glossary/roas)"), "body still linked");

// Existing links are protected (no nesting inside them).
const d = autolinkTerms("See [our ROAS guide](/blog/x) and track ROAS daily.");
assert.equal(d, "See [our ROAS guide](/blog/x) and track [ROAS](/glossary/roas) daily.", "skips inside existing link, links the plain one");

// selfSlug: a term's own page never links to itself.
const e = autolinkTerms("CAC is the cost. CAC and CPA differ.", "cac");
assert.ok(!e.includes("/glossary/cac"), "self term not linked");
assert.ok(e.includes("[CPA](/glossary/cpa)"), "other term still linked");

// Case-insensitive match preserves original casing in the link text.
const f = autolinkTerms("frequency climbs over time.");
assert.equal(f, "[frequency](/glossary/frequency) climbs over time.", "lowercase mention links, case preserved");

console.log("PASS check-autolink: first-occurrence, longest-wins, headings/links/self protected");
