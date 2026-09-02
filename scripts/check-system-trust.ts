// Proof for system trust (§8-12): a data conflict caps trust at "shaky"; proven good decisions + clean data =
// "trusted"; unproven = "watch". Run: node --experimental-strip-types scripts/check-system-trust.ts

import assert from "node:assert/strict";
import type { ReconSummary } from "../lib/intelligence/reconcile.ts";
import type { AccuracyStats } from "../lib/intelligence/outcome.ts";
import { systemTrust } from "../lib/intelligence/system-trust.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const recon = (conflicts: number, drifts = 0): ReconSummary => ({ checked: 3, matches: 3 - conflicts - drifts, drifts, conflicts, worstDriftPct: conflicts ? 0.2 : 0, trustworthy: conflicts === 0 });
const acc = (trustworthy: boolean, hitRate: number | null, n: number): AccuracyStats => ({ n, trustworthy, hitRate, byKind: {}, falsePositives: 0, falseNegatives: 0 });

// clean data + proven good decisions -> trusted.
const t = systemTrust(recon(0), acc(true, 0.82, 40), 30, 3);
ok(t.tier === "trusted" && t.dataOk && t.decisionsProven, "clean data + 82% proven -> trusted");

// a data conflict caps at shaky even with great decisions.
const s = systemTrust(recon(1), acc(true, 0.95, 40), 30, 0);
ok(s.tier === "shaky" && !s.dataOk, "any source conflict -> shaky regardless of decision quality");
ok(s.reasons.some((r) => /conflict/.test(r)), "reason names the conflict");

// clean data but unproven decisions -> watch.
const w = systemTrust(recon(0), acc(false, null, 5), 5, 1);
ok(w.tier === "watch" && !w.decisionsProven, "unproven decisions -> watch");
ok(w.reasons.some((r) => /not yet proven/.test(r)), "reason says accuracy not yet proven");

// clean + proven but a poor hit-rate -> watch (not trusted).
ok(systemTrust(recon(0), acc(true, 0.5, 40), 30, 0).tier === "watch", "proven but only 50% right -> watch");

// critic downgrading most decisions -> watch + flagged.
const c = systemTrust(recon(0), acc(true, 0.8, 40), 30, 20);
ok(c.tier === "watch" && c.reasons.some((r) => /critic lowered/.test(r)), "critic lowering >=50% -> watch + flagged");

console.log(`check-system-trust: ${pass} assertions passed.`);
