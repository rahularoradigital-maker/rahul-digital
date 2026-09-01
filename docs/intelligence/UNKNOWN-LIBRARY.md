# AdScale — Unknown Library (deliverable #106)
**Date:** 2026-09-01. What the system CANNOT currently know, so it never pretends to. Charter §5/§106: the system must be comfortable saying UNKNOWN / INSUFFICIENT DATA / HOLD.

## Structural unknowns (no data source yet)
- **Economic contribution / true profit** — no margin, COGS, fulfillment, refund, fee data (no Shopify). All ROAS is platform ROAS, never contribution. nCAC/MER/LTV/payback are UNKNOWN until commerce data connects (charter §61-64).
- **Incrementality** — no holdout/experiment infrastructure; "ROAS" is correlational, not causal (§50, §97).
- **Cross-source truth** — only Meta today; Google adapter is a TODO-stub; no Shopify/Triple-Whale. Cannot reconcile platform vs store (§56-58).
- **Inventory / stock** — cannot warn against scaling unavailable products (§65).

## Verification unknowns (need a live check — flagged by Phase 0, not resolvable by static read)
- **Custom date range:** DRIFT — PROJECT-LEDGER says 🔴 partial; code asserts a fixed 90-day `COMPARISON_DAYS`. Is the window selector real or overridden? LIVE-CHECK.
- **`syncedAt` freshness** may render undefined on store-served cockpits (staleness not shown as stale). LIVE-CHECK.
- Whether `assessDataQuality` emits any sync-staleness signal at all. LIVE-CHECK.
- RLS state of the ~12 live-only tables absent from migrations. DB-CHECK.
- Core Web Vitals / JS bundle sizes / console-error count — no runtime was available in Phase 0. RUNTIME-CHECK (the SEO plan's Phase 2).

## Evidence unknowns (logic exists but is unvalidated)
- ~30 of 40 formulas are evidence-level C/D. Their thresholds are heuristics/priors, NOT measured from account outcomes. Every C/D logic in `500-LOGIC-INVENTORY.md` is a hypothesis until account data validates it (§15) — it must never be presented to a user as certainty.

## Rule
When any input above is missing, the honest output is UNKNOWN / INSUFFICIENT DATA / HOLD with the reason — never a zero, never a fabricated number, never a confident guess (§79, §128).
