// Proof for the AI Critic's guardrails (accuracy spec §55/§56): the critic can only LOWER confidence, never
// raise it, and never overrides the deterministic engine. Run: node --experimental-strip-types scripts/check-critic.ts

import { clampConfidence, normalizeVerdict, applyCritique } from "../lib/judgment/critic-core.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

// clampConfidence: the AI can never RAISE confidence (§56 - AI agreement is not proof)
ok(clampConfidence("low", "high") === "low", "AI proposing 'high' cannot raise a 'low' verdict");
ok(clampConfidence("med", "high") === "med", "AI proposing 'high' cannot raise a 'med' verdict");
ok(clampConfidence("high", "low") === "low", "AI CAN lower high -> low");
ok(clampConfidence("high", "med") === "med", "AI CAN lower high -> med");
ok(clampConfidence("high", undefined) === "high", "no proposal -> unchanged");
ok(clampConfidence("med", "junk" as never) === "med", "an invalid proposal is ignored (unchanged)");

// normalizeVerdict: unknown -> 'flag' (surface for review, never silently uphold)
ok(normalizeVerdict("upheld") === "upheld", "recognizes upheld");
ok(normalizeVerdict("DOWNGRADE") === "downgrade", "case-insensitive");
ok(normalizeVerdict("") === "flag", "empty -> flag");
ok(normalizeVerdict("looks fine to me") === "flag", "garbage -> flag (surfaced, not upheld)");

// applyCritique: upheld keeps confidence; downgrade/flag can only lower it
ok(applyCritique("high", "upheld", "low") === "high", "upheld never changes the engine's confidence");
ok(applyCritique("high", "downgrade", "low") === "low", "downgrade lowers toward the proposed tier");
ok(applyCritique("high", "downgrade", "high") === "high", "a downgrade that proposes 'high' still cannot raise/keep-high beyond original (clamped)");
ok(applyCritique("low", "flag", "high") === "low", "a flag on a 'low' verdict cannot raise it");
ok(applyCritique("med", "flag", undefined) === "low", "flag with no proposal defaults to lowering");

console.log(`check-critic: ${pass} assertions passed.`);
