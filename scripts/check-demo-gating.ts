// Cleanup #3 guard: demo/stub paths must be OFF by default so production never serves fake output. Asserts
// the honest demo-mode gate defaults to disabled and only turns on with an explicit opt-in.
// Run: node --experimental-strip-types scripts/check-demo-gating.ts
import assert from "node:assert/strict";
import { demoPathsAllowed } from "../lib/demo-mode.ts";

const original = process.env.ALLOW_DEMO_PATHS;
function set(v: string | undefined) {
  if (v === undefined) delete process.env.ALLOW_DEMO_PATHS;
  else process.env.ALLOW_DEMO_PATHS = v;
}

try {
  set(undefined);
  assert.equal(demoPathsAllowed(), false, "demo paths OFF when ALLOW_DEMO_PATHS is unset (production default)");
  set("");
  assert.equal(demoPathsAllowed(), false, "empty string does not enable demo paths");
  set("0");
  assert.equal(demoPathsAllowed(), false, "'0' does not enable demo paths");
  set("false");
  assert.equal(demoPathsAllowed(), false, "'false' does not enable demo paths");
  set("1");
  assert.equal(demoPathsAllowed(), true, "'1' explicitly opts in to demo paths");
  set("true");
  assert.equal(demoPathsAllowed(), true, "'true' explicitly opts in to demo paths");
} finally {
  set(original);
}

console.log("PASS: demo-path gating (off by default; explicit opt-in only) - production never serves fake output");
