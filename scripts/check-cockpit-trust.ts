// Proof for the live cockpit trust read (§8-12/§130): insufficient/untrustworthy data -> shaky; stale or
// gappy -> watch; complete+fresh+vouched -> trusted. Run: node --experimental-strip-types scripts/check-cockpit-trust.ts

import assert from "node:assert/strict";
import type { CockpitData } from "../lib/app/cockpit-data.ts";
import { cockpitTrust } from "../lib/intelligence/cockpit-trust.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

const d = (o: Record<string, unknown>): CockpitData => ({ connected: true, dataQuality: { status: "ok", trustworthy: true, completeness: 0.95 }, stale: false, headlineIncomplete: false, ...o } as unknown as CockpitData);

// complete + fresh + vouched -> trusted.
ok(cockpitTrust(d({})).tier === "trusted", "clean data -> trusted");

// insufficient data -> shaky.
ok(cockpitTrust(d({ dataQuality: { status: "insufficient_data" } })).tier === "shaky", "insufficient data -> shaky");

// quality engine says not trustworthy -> shaky.
ok(cockpitTrust(d({ dataQuality: { status: "ok", trustworthy: false, completeness: 0.9 } })).tier === "shaky", "untrustworthy window -> shaky");

// stale -> watch (usable but flagged).
const s = cockpitTrust(d({ stale: true }));
ok(s.tier === "watch" && s.reasons.some((r) => /stale/.test(r)), "stale -> watch + reason");

// gappy completeness -> watch.
ok(cockpitTrust(d({ dataQuality: { status: "ok", trustworthy: true, completeness: 0.6 } })).tier === "watch", "60% completeness -> watch");

// headline incomplete -> watch + reason.
ok(cockpitTrust(d({ headlineIncomplete: true })).reasons.some((r) => /assembling|incomplete/.test(r)), "incomplete headline -> flagged");

// not connected -> shaky.
ok(cockpitTrust({ connected: false } as unknown as CockpitData).tier === "shaky", "not connected -> shaky");

console.log(`check-cockpit-trust: ${pass} assertions passed.`);
