// Phase 12 second/third/fourth-order reasoning. Run: npm run check:creative-os-second-order
import { strict as assert } from "node:assert";
import { reasonChain } from "../lib/creative-os/second-order.ts";

function main() {
  // Under-used combo -> 4th order asserts a new territory to claim.
  const open = reasonChain({ winningFormat: "ugc", persona: "busy mom", refinement: "demonstration-led", marketShareOfCombo: 0.05 });
  assert.ok(open.firstOrder.includes("UGC") && open.firstOrder.includes("busy mom"));
  assert.ok(open.secondOrder.includes("demonstration-led"));
  assert.ok(/under-using/i.test(open.thirdOrder), "low share -> market is under-using it");
  assert.ok(/Build a creative territory/i.test(open.fourthOrder), "under-used -> claim the territory");
  assert.deepEqual(open.territory, { persona: "busy mom", angle: "demonstration-led", format: "ugc" });

  // Crowded combo -> 4th order pivots to differentiation, not land-grab (evidence-gated honesty).
  const crowded = reasonChain({ winningFormat: "ugc", persona: "busy mom", refinement: "demonstration-led", marketShareOfCombo: 0.6 });
  assert.ok(/already uses/i.test(crowded.thirdOrder), "high share -> market already uses it");
  assert.ok(/Differentiate/i.test(crowded.fourthOrder), "crowded -> differentiate, don't claim");

  console.log("PASS: creative-os second-order (chain builds; evidence-gated 4th-order territory vs differentiation)");
}

main();
