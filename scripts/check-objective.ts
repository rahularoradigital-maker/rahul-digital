// Runnable check for lib/meta-source.ts mapMetaObjective. check-crypto style: node:assert
// strict, prints one PASS line. Run: node --experimental-strip-types scripts/check-objective.ts
import assert from "node:assert/strict";
import { mapMetaObjective } from "../lib/meta-source.ts";

assert.equal(mapMetaObjective("OUTCOME_AWARENESS"), "awareness");
assert.equal(mapMetaObjective("REACH"), "awareness");
assert.equal(mapMetaObjective("OUTCOME_SALES"), "conversion");
assert.equal(mapMetaObjective("LINK_CLICKS"), "traffic");
assert.equal(mapMetaObjective("OUTCOME_LEADS"), "leads");
assert.equal(mapMetaObjective("VIDEO_VIEWS"), "engagement");
assert.equal(mapMetaObjective("OUTCOME_APP_PROMOTION"), "app_installs");
assert.equal(mapMetaObjective(undefined), "conversion");

console.log("PASS: Meta objective mapping checks");
