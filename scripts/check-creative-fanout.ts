// Runnable check for the creative fan-out cost (ISSUE 22). No env needed.
//   node --experimental-strip-types scripts/check-creative-fanout.ts
// Pins the per-creative Gemini call count so any change to the fan-out is a conscious, visible decision
// (the audit's "a multi-agent architecture must earn its extra calls"). If a specialist/dependent agent
// is added, this fails until CALLS_PER_CREATIVE and the cost trade-off are re-confirmed.
import { strict as assert } from "node:assert";
import { CALLS_PER_CREATIVE } from "../lib/agents/creative/orchestrator.ts";
import { SPECIALIST_AGENTS, DEPENDENT_AGENTS } from "../lib/agents/creative/agents.ts";

assert.equal(CALLS_PER_CREATIVE, SPECIALIST_AGENTS.length + DEPENDENT_AGENTS.length, "constant tracks the agent config");
assert.equal(CALLS_PER_CREATIVE, 6, `per-creative fan-out changed to ${CALLS_PER_CREATIVE} - re-confirm the cost trade-off, then update this number`);

console.log(`PASS: creative fan-out = ${CALLS_PER_CREATIVE} Gemini calls/creative (tracked; measured in server logs)`);
