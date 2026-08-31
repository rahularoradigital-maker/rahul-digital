// Proof for the content quality gate: it BLOCKS critical brand risks (unsupported claims, undisclosed/
// disallowed AdBrain mentions) and only WARNS on softer issues (hype, unsourced stat, salesy).
// Run: node --experimental-strip-types scripts/check-quality-gate.ts

import { checkContent } from "../lib/growth/quality.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}
const crit = (r: ReturnType<typeof checkContent>) => r.flags.some((f) => f.severity === "critical");

// clean, useful reply -> passes, no flags
const clean = checkContent("Frequency above 3 usually means your audience is seeing the ad too often - try widening the audience or refreshing the creative.", { mayMention: false });
ok(clean.pass && clean.flags.length === 0, "a clean, useful reply passes with no flags");

// unsupported absolute claim -> BLOCKED
ok(!checkContent("This will guarantee you double your ROAS.", { mayMention: true }).pass, "a 'guarantee/double ROAS' claim is blocked");
ok(!checkContent("AdBrain is the best tool and always works.", { mayMention: true }).pass, "'the best / always works' is blocked");

// AdBrain mention without disclosure -> BLOCKED
ok(!checkContent("You should try AdBrain for this.", { mayMention: true }).pass, "mentioning AdBrain without disclosure is blocked");
// with disclosure -> allowed
ok(checkContent("Full disclosure, I work on AdBrain - it reads your day-wise data and flags this.", { mayMention: true }).pass, "an AdBrain mention WITH disclosure + allowed context passes");
// mention where not allowed -> BLOCKED even with disclosure
ok(!checkContent("Full disclosure, I work on AdBrain, give it a try.", { mayMention: false }).pass, "an AdBrain mention where not permitted is blocked");

// soft issues are WARN, not blocking
const hype = checkContent("This will supercharge and revolutionize your funnel.", { mayMention: false });
ok(hype.pass && hype.flags.some((f) => f.code === "hype" && f.severity === "warn"), "hype is a warning, not a block");
const stat = checkContent("Our data shows a 47% lift.", { mayMention: false });
ok(stat.pass && stat.flags.some((f) => f.code === "unsourced_stat"), "a specific stat is flagged for review (warn)");
const salesy = checkContent("Great question! Check it out and sign up now.", { mayMention: false });
ok(salesy.pass && salesy.flags.some((f) => f.code === "salesy"), "salesy wording is a warning");

console.log(`check-quality-gate: ${pass} assertions passed.`);
