// Guards the Creative Intelligence Schema taxonomy (Master Phase Plan spine). Run: npm run check:creative-os-schema
import { strict as assert } from "node:assert";
import {
  PATTERN_TYPES, PATTERN_SOURCES, OPPORTUNITY_STATUSES,
  isPatternType, isPatternSource, isOpportunityStatus,
} from "../lib/creative-os/schema.ts";

function main() {
  // The taxonomy must cover every pattern object the plan's Pattern Extraction lists.
  const required = ["persona", "problem", "desire", "objection", "trigger", "angle", "hook", "visual_hook", "format", "language", "proof"];
  for (const t of required) assert.ok(PATTERN_TYPES.includes(t as (typeof PATTERN_TYPES)[number]), `pattern taxonomy missing "${t}"`);
  assert.equal(PATTERN_TYPES.length, required.length, "pattern taxonomy has unexpected extra/missing types");

  // Sources ground every pattern in a real origin (no fabricated personas).
  for (const s of ["own_ad", "competitor", "social", "review", "manual"]) assert.ok((PATTERN_SOURCES as readonly string[]).includes(s), `source "${s}" missing`);

  // Guards accept valid values and reject junk.
  assert.ok(isPatternType("hook") && !isPatternType("nope"));
  assert.ok(isPatternSource("review") && !isPatternSource("nope"));
  assert.ok(isOpportunityStatus("open") && !isOpportunityStatus("nope"));

  // Opportunity lifecycle is complete (open → concept → testing → won/lost/dismissed).
  for (const s of ["open", "in_concept", "testing", "won", "lost", "dismissed"]) assert.ok((OPPORTUNITY_STATUSES as readonly string[]).includes(s), `status "${s}" missing`);

  console.log("PASS: creative-os schema (pattern taxonomy complete, sources grounded, opportunity lifecycle, guards)");
}

main();
