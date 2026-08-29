// One runnable check for the image-provider abstraction (Creative Production, Phase 6). No frameworks.
// Tests the pure pieces (pricing + the stub provider implementing the ImageProvider contract) - the Google
// adapter is server-only + hits the network, so it is verified live via probeImageProvider, not here.
// Run: node --experimental-strip-types scripts/check-cp-provider.ts
import assert from "node:assert/strict";
import { priceFor, estimateCost } from "../lib/creative-production/providers/pricing.ts";
import { stubImageProvider } from "../lib/creative-production/providers/stub.ts";
import type { GenerationBrief } from "../lib/creative-production/types.ts";

// Pricing: known model prefixes map to their per-image USD; unknown falls back sensibly.
assert.equal(priceFor("gemini-3-pro-image-preview"), 0.134, "pro price");
assert.equal(priceFor("gemini-3.1-flash-image-preview"), 0.067, "flash price");
assert.equal(priceFor("gemini-2.5-flash-image"), 0.039, "legacy price");
assert.equal(priceFor("something-unknown"), 0.067, "unknown -> default");
// lite must not be shadowed by the flash prefix (order matters).
assert.equal(priceFor("gemini-3.1-flash-lite-image"), 0.0336, "lite price distinct from flash");

// Cost estimate: linear in asset count, rounded to 3 decimals.
const brief = { promptVersion: "v1" } as GenerationBrief;
const est = estimateCost([brief, brief, brief], "google", "gemini-3.1-flash-image-preview");
assert.equal(est.assets, 3);
assert.equal(est.totalUsd, 0.201, "3 x 0.067 = 0.201");
assert.equal(estimateCost([], "google", "gemini-3.1-flash-image-preview").totalUsd, 0, "no assets -> 0");

// The stub implements the full ImageProvider contract and always returns an image (pipeline stays alive).
const caps = stubImageProvider.getCapabilities();
assert.ok(caps.generation && caps.editing, "stub advertises generation + editing");
const gen = await stubImageProvider.generateCreative(brief);
assert.ok(gen.ok && gen.imageBase64 && gen.mimeType === "image/png", "stub returns a png");
assert.equal(gen.costUsd, 0, "stub is free");
assert.equal(await stubImageProvider.getGenerationStatus("x"), "done");

console.log("PASS: image-provider pricing + stub contract (env-driven provider, cost math, keyless pipeline)");
