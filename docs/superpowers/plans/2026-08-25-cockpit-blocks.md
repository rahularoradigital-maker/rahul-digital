# Cockpit Building Blocks (credential-free) — Implementation Plan

**Goal:** Build the remaining pure/credential-free cockpit pieces: complete the rules engine and
add the Deconstructor + Explainer prompt modules. No external services; everything testable offline.

## Global Constraints
- Follow the existing patterns exactly: rules = pure functions returning an `insufficient_data`
  sentinel on thin input, NEVER a guessed number (see `lib/rules/fatigue.ts`); prompt modules
  mirror `lib/prompts/strategist.ts` (`export const X = { version, template }` + types).
- Tests follow `scripts/check-crypto.ts` exactly: `node:assert`, `../lib/...ts` imports, print a
  `PASS: ...` line, runnable via `node --experimental-strip-types`.
- Do NOT edit package.json/tsconfig/other existing files except where a task names them.
- `npm run build` green + the task's check PASS before the task is done.

---

### Task 1: Complete the rules engine (health + will-break)
**Files:** Create `lib/rules/health.ts`, `lib/rules/will-break.ts`, `scripts/check-rules-extra.ts`.
Modify `package.json` (add `check:rules-extra`), `.github/workflows/ci.yml` (add the step).
**Interfaces:**
- `lib/rules/will-break.ts`: `export function willBreak(rows: MetricsRow[]): { status:"ok"; breaks:boolean; daysToBreak:number|null; urgency:number /*0-1*/ } | { status:"insufficient_data" }`.
  Uses `fatigue()` from `./fatigue`; if pastHalfLife → breaks=true, estimate daysToBreak by
  extrapolating the CTR/frequency trend (simple linear, documented ceiling), urgency from the
  fatigue score. `< 7` rows → insufficient_data.
- `lib/rules/health.ts`: `export function healthScore(input: { totalAds:number; fatiguedAds:number; realDiversity:number; roasOk:boolean }): { status:"ok"; green:number; total:number; pct:number } | { status:"insufficient_data" }`.
  total=70 (documented scale); green rises with roasOk and diversity, falls with fatiguedAds/totalAds.
  `totalAds===0` → insufficient_data. pct = green/total.
- `scripts/check-rules-extra.ts`: assert willBreak on a clearly-fatigued fixture → breaks=true with
  urgency>0; on a healthy fixture → breaks=false; `<7` rows → insufficient_data (NO numeric fields).
  Assert healthScore green in [0,70], pct correct, and `totalAds:0` → insufficient_data. Print
  `PASS: rules extra checks`.
**Verify:** `node --experimental-strip-types scripts/check-rules-extra.ts` prints PASS; `npm run build` green.

### Task 2: Deconstructor + Explainer prompt modules
**Files:** Create `lib/prompts/deconstructor.ts`, `lib/prompts/explainer.ts`, `scripts/check-prompts.ts`.
Modify `package.json` (add `check:prompts`), `.github/workflows/ci.yml` (add the step).
**Interfaces:** mirror `lib/prompts/strategist.ts`.
- `deconstructor.ts`: `export const DECONSTRUCTOR = { version:"1.0", template }` where `template` is the
  Deconstructor prompt from `docs/ai/prompt-chain-spec.md` §"Step 1 — Deconstruct" (observe → classify
  → flag uncertainty → emit; describe don't judge), preserving placeholders `{{taxonomy}}`, `{{copy}}`,
  `{{creative}}`, `{{schema}}`. Export types `DeconstructAttributes` and `DeconstructOutput`
  (`{ attributes: {...}, triples: {subject,predicate,object,confidence}[] }`).
- `explainer.ts`: `export const EXPLAINER = { version:"1.0", template }` from §"Step 5 — Explain"
  (restate provided facts; introduce NO new number; missing field → "source unavailable"), preserving
  `{{number_data}}`, `{{schema}}`. Export type `ExplainOutput = { rows: {label:string; value:string}[] }`.
- `scripts/check-prompts.ts`: assert each module exports `version` and a non-empty `template`, that the
  template contains its required `{{placeholders}}`, and that the exported types are usable (construct a
  sample object). Print `PASS: prompt module checks`.
**Verify:** `node --experimental-strip-types scripts/check-prompts.ts` prints PASS; `npm run build` green.

---
## Success criteria
- Both tasks: build green + their checks PASS. Rules functions never fabricate a number on thin input.
