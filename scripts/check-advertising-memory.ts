// Runnable check for Advertising Memory relevance (Track A, Phase A2). Pure, no network, no env.
//   node --experimental-strip-types scripts/check-advertising-memory.ts
// Proves "load when relevant": each operation kind pulls ONLY the rules it needs (a budget change never
// drags in creative tone; a creative brief never drags in budget thresholds), and rule coercion bounds input.
import { strict as assert } from "node:assert";
import { selectMemory, coerceRules, DEFAULT_RULES } from "../lib/operations/rules.ts";
import type { Operation } from "../lib/operations/types.ts";

const RULES = { maxBudgetStepPct: 20, minRoas: 2.5, protectedCampaigns: ["Always-On Brand"], creativeTone: "plain, no hype" };
const op = (kind: Operation["kind"]): Operation => ({ kind, status: "draft", source: "ask", intentText: "x", slots: {}, evidence: [] });

// 1) Budget change -> budget rules + change history, NOT creative tone.
const b = selectMemory(op("propose_budget_change"), RULES);
assert.equal(b.rules.maxBudgetStepPct, 20);
assert.equal(b.rules.minRoas, 2.5);
assert.ok(!("creativeTone" in b.rules), "budget change does not pull creative tone");
assert.deepEqual(b.historyNeeded, ["target_performance", "recent_changes"]);

// 2) Pause -> protected campaigns + floor ROAS, NOT budget step or tone.
const p = selectMemory(op("propose_pause"), RULES);
assert.deepEqual(p.rules.protectedCampaigns, ["Always-On Brand"]);
assert.equal(p.rules.minRoas, 2.5);
assert.ok(!("maxBudgetStepPct" in p.rules) && !("creativeTone" in p.rules), "pause pulls only pause-relevant rules");

// 3) Creative -> tone only, NOT budget/roas.
const c = selectMemory(op("launch_creative"), RULES);
assert.equal(c.rules.creativeTone, "plain, no hype");
assert.ok(!("maxBudgetStepPct" in c.rules) && !("minRoas" in c.rules), "creative pulls only tone");
assert.deepEqual(c.historyNeeded, ["brand_dna"]);

// 4) Answer / diagnose -> no rules (plain read), just the account snapshot history.
assert.deepEqual(selectMemory(op("answer"), RULES).rules, {}, "answer needs no rules");
assert.deepEqual(selectMemory(op("diagnose"), RULES).rules, {}, "diagnose needs no rules");

// 5) coerceRules bounds the trust boundary: junk -> null / empty, out-of-range dropped, list bounded + typed.
const coerced = coerceRules({ maxBudgetStepPct: 999, minRoas: "3", protectedCampaigns: ["A", 5, "  B  ", ""], creativeTone: 42, junk: "x" });
assert.equal(coerced.maxBudgetStepPct, null, "999% is out of range -> null");
assert.equal(coerced.minRoas, 3, "numeric string coerced");
assert.deepEqual(coerced.protectedCampaigns, ["A", "B"], "non-strings/blanks dropped, trimmed");
assert.equal(coerced.creativeTone, null, "non-string tone -> null");
assert.ok(!("junk" in coerced), "unknown keys dropped");
assert.deepEqual(coerceRules(null), DEFAULT_RULES, "null blob -> defaults");

console.log("OK check-advertising-memory: relevance-scoped rules per kind, bounded coercion, safe defaults.");
