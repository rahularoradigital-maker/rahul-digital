// Proof for the kill-switch / feature-flag precedence (pure core, no DB):
//   kill:    env-truthy wins outright; else DB row; else OFF (running)
//   feature: env explicit (1/0) wins; else DB; else code default
// Run: node --experimental-strip-types scripts/check-flags.ts

import { decideKill, decideFeature, killEnvName, featureEnvName } from "../lib/security/flags.ts";

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  pass++;
}

// kill switch
ok(decideKill(undefined, null) === false, "no env, no DB -> not killed (running)");
ok(decideKill("1", null) === true, "env=1 -> killed even with no DB");
ok(decideKill("true", false) === true, "env truthy overrides a DB 'not killed'");
ok(decideKill(undefined, true) === true, "DB enabled -> killed");
ok(decideKill("0", true) === true, "env '0' does not UN-kill a DB kill (kill = OR of the two)");
ok(decideKill("nonsense", null) === false, "non-truthy env string -> not killed");

// feature flag
ok(decideFeature(undefined, null, true) === true, "no env, no DB -> code default (on)");
ok(decideFeature(undefined, null, false) === false, "no env, no DB -> code default (off)");
ok(decideFeature("0", null, true) === false, "env '0' turns a default-on feature OFF");
ok(decideFeature("1", false, false) === true, "env '1' turns a default-off feature ON, beating DB");
ok(decideFeature(undefined, true, false) === true, "DB on beats code default off");
ok(decideFeature("", false, true) === false, "empty env falls through to DB (off)");

// env var naming
ok(killEnvName("ai") === "KILL_AI", "kill env name");
ok(featureEnvName("influencer_hunt") === "FEATURE_INFLUENCER_HUNT", "feature env name");

console.log(`check-flags: ${pass} assertions passed.`);
