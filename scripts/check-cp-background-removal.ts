// One runnable check for the background-removal provider selection (product-fidelity path). No frameworks.
// Only the PURE selectRemover() is exercised - no network. Run:
//   node --experimental-strip-types scripts/check-cp-background-removal.ts
import assert from "node:assert/strict";
import { selectRemover, borderIsLight } from "../lib/creative-production/media/background-removal.ts";

// Photoroom wins when its key is present (preferred: more accurate + cheaper per research).
assert.equal(selectRemover({ PHOTOROOM_API_KEY: "pk", REMOVEBG_API_KEY: "rk" }), "photoroom");
assert.equal(selectRemover({ PHOTOROOM_API_KEY: "pk" }), "photoroom");
// remove.bg is the fallback when only its key is present.
assert.equal(selectRemover({ REMOVEBG_API_KEY: "rk" }), "removebg");
// No key -> "none" (keyless stub: still returns the real product, just uncut).
assert.equal(selectRemover({}), "none");
// Blank/whitespace keys count as absent.
assert.equal(selectRemover({ PHOTOROOM_API_KEY: "   ", REMOVEBG_API_KEY: "" }), "none");

// borderIsLight: the keyless white-key only fires on a genuine light background (Shopify product-on-white),
// never on a coloured/lifestyle photo (which would get mangled -> we keep the uncut image instead).
function solid(w: number, h: number, r: number, g: number, b: number): Uint8Array {
  const d = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
  return d;
}
const W = 40, H = 40;
// A white canvas with a black product block in the CENTRE (border stays white) -> light border.
const white = solid(W, H, 255, 255, 255);
for (let y = 12; y < 28; y++) for (let x = 12; x < 28; x++) { const i = (y * W + x) * 4; white[i] = white[i + 1] = white[i + 2] = 10; }
assert.equal(borderIsLight(white, W, H, 4), true, "product-on-white -> border is light (white-key will run)");
// A saturated/coloured lifestyle background -> border NOT light (white-key must NOT run).
assert.equal(borderIsLight(solid(W, H, 40, 90, 160), W, H, 4), false, "coloured background -> border not light (keep uncut image)");
assert.equal(borderIsLight(solid(W, H, 200, 200, 200), W, H, 4), false, "mid-grey background is below the light threshold -> not keyed");

console.log("OK check-cp-background-removal: provider selection + light-border detection correct.");
