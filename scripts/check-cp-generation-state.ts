// Proof that the truthful generation state is derived correctly - a compositor-only fallback is NEVER an AI ad.
// Run: node --experimental-strip-types scripts/check-cp-generation-state.ts
import { deriveGenerationState } from "../lib/creative-production/generation-state.ts";
let pass = 0;
function ok(c: boolean, m: string) { if (!c) throw new Error("FAIL: " + m); pass++; }
ok(deriveGenerationState(true, false) === "AI_GENERATED", "AI visual, primary -> AI_GENERATED");
ok(deriveGenerationState(true, true) === "AI_GENERATED_WITH_FALLBACK", "AI visual, fallback -> AI_GENERATED_WITH_FALLBACK");
ok(deriveGenerationState(false, false) === "COMPOSITOR_ONLY", "no AI visual -> COMPOSITOR_ONLY (never AI)");
ok(deriveGenerationState(false, true) === "COMPOSITOR_ONLY", "no AI visual wins even if a model was tried");
console.log(`check-cp-generation-state: ${pass} assertions passed.`);
