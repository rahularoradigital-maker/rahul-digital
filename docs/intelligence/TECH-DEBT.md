# AdBrain — Tech-Debt Inventory (Phase 0, read-only) — 2026-09-01

Charter §8 (tech-debt inventory) + §88 delete-before-add. Every item is grounded in a file:line or a
command output; no invented debt. This **supersedes** the pre-build `docs/tech-debt.md` (which describes
a "few-hundred-lines-of-code" era; see item D5). Priority: **P0** correctness/security/data-integrity ·
**P1** high-impact clarity/maintainability · **P2** structural/duplication · **P3** cosmetic/stale-doc.
Recommendation verbs follow §88: **DELETE** (dead) · **MERGE** (fold into the live one) · **KEEP** (with note).

No item here is a live P0 correctness bug — the debt is **duplication + spec-ahead-of-code + stale docs**,
consistent with the project's own diagnosis. Nothing recommends removing a wired screen/handler/data (Rule #2).

---

## Register

| # | Item | Evidence (file:line) | Impact | P | Rec |
|---|------|----------------------|--------|---|-----|
| 1 | **Competing decision engines.** `lib/decision.ts` (OBSERVATION→DIAGNOSIS brief.md engine) has **zero production importers** — only `scripts/check-decision.ts` exercises it, which keeps it "green" and hides that it is unwired. The live engine is `lib/scoring/decision.ts` (`decide()`), imported by the cockpit. | live: `lib/cockpit/analyze.ts:15` → `../scoring/decision`. orphan: `lib/decision.ts:1`, sole importer `scripts/check-decision.ts:5`. | Two parallel decision paths (root one also drags in `rules/registry` + `causality`); readers can't tell which is canonical; §88 violation. | P2 | **DELETE** `lib/decision.ts` + `scripts/check-decision.ts` (drop from `check:all`), OR add a header stating it's a retired spec seam. |
| 2 | **Competing data-quality engines.** `lib/data-quality.ts` has zero prod importers (only `scripts/check-quality.ts`). Live one is `lib/scoring/data-quality.ts` (5 importers incl. `cockpit/from-store`, `meta-sync`, `google/cockpit`). | orphan: `lib/data-quality.ts:1`, sole importer `scripts/check-quality.ts:11`. live: `lib/cockpit/from-store.ts:11`. | Same-name confusion; a future edit could touch the dead copy and pass the gate with no effect. | P2 | **DELETE** `lib/data-quality.ts` + `scripts/check-quality.ts`, keep `lib/scoring/data-quality.ts`. |
| 3 | **`lib/google-source.ts` is a demo stub, not a real Google adapter.** GAQL queries + OAuth token exchange are TODO-only; the Google path returns demo data. | `lib/google-source.ts:60,67,75` (`TODO(real): GAQL …`, `TODO(real): POST oauth2 …`). | Google "platform selector" is not production; matches `docs/google-ads-architecture.md` (needs dev token + OAuth). Risk only if UI implies Google is live. | P2 | **KEEP**, but ensure the UI labels Google as demo until creds land; track as a feature gap, not a bug. |
| 4 | **`lib/fingerprint.ts` — unwired semantic layer.** Self-documented as NOT the production path; only `scripts/check-diversity.ts` uses it. Live creative facts come from `lib/creative/fingerprint.ts`. | `lib/fingerprint.ts:1-7` (header: "NOT the production fingerprint … Do not build a second production path here"). | Deliberate designed seam for future embedding-similarity; low risk because it is clearly labelled. | P3 | **KEEP** (documented seam). Revisit-by: delete if the embedding path is never productionized. |
| 5 | **`fnv1a` hash re-implemented in 3 places.** | `lib/creative/fingerprint.ts`, `lib/creative-production/generation/brief-hash.ts:7` ("Copied inline … kept dependency-free"), `lib/google-source.ts`. | Minor logic duplication; the brief-hash copy documents *why* (no cross-module dep). | P3 | **KEEP-with-note** or extract one `lib/hash.ts` util if a 4th copy appears. |
| 6 | **`meta-source.ts` (1120 lns) + `meta-sync.ts` (737 lns) have ~doubled** since the last audit snapshot and are the logic-heaviest non-data files. | `wc -l lib/meta-source.ts lib/meta-sync.ts`; cf. `docs/audit-state.json` (606/531). | Growing single-file surface for the most correctness-critical ingest path; harder to test in isolation. | P2 | **KEEP**; consider splitting pull/normalize/paginate into modules when next touched (not a rewrite). |
| 7 | **`docs/audit-state.json` is stale.** Reports `meta-source.ts`=606, 185 source files, 2 large files. Actual: 1120 / 215 in `lib/` alone / `kpi-catalog.ts`=2442. Generated 2026-08-28. | `docs/audit-state.json:20-32` vs `find lib -name '*.ts' \| wc -l` = 215. | A machine-readable "state" file that lies undermines any tooling that trusts it. | P3 | **MERGE/regenerate** from a script, or delete if unused. |
| 8 | **`docs/tech-debt.md` describes a pre-build codebase.** "few hundred lines of code", "only 2 checks today", provider-drift (Claude) as open. Reality: ~39k LOC, 116 `check:*`, Claude removed. | `docs/tech-debt.md:6-11,20-26`; `grep -c 'check:' package.json` = 116. | Two tech-debt docs now disagree; readers may act on the stale one. | P3 | **MERGE** into this file; leave a one-line pointer stub at the old path. |
| 9 | **Stale "dead Claude code" claims.** DECISIONS D6 + `docs/tech-debt.md` items 4/10 still list `lib/anthropic.ts` / `app/api/health/claude` as present dead code. Both paths do not exist. | `ls lib/anthropic.ts` → no such file; `DECISIONS.md:51-53`. | Resolved debt still tracked as open = noise. | P3 | **DELETE** the stale note (mark D6 implementation-status done). |
| 10 | **Residual "AdScale" brand strings** after the AdScale→AdBrain rename. Mostly code comments, but present in `lib/judgment/rules.json` and `lib/blog/curated-articles.json` (potentially content-facing). | `grep -rn AdScale lib app components`; e.g. `lib/reconcile/scopes.ts:2`, `lib/judgment/rules.json`. | Cosmetic/brand consistency; only a risk if user-visible. | P3 | **KEEP**; sweep to "AdBrain" in any user-visible string; comments optional. |
| 11 | **Orphan-engine checks inflate the green gate.** `check-decision` + `check-quality` pass against unwired code (items 1-2), so `check:all` GREEN over-states coverage of the *live* path. | `scripts/check-decision.ts:5`, `scripts/check-quality.ts:11`. | The gate's authority is diluted; a dead path stays "tested". | P2 | Resolve with items 1-2 (delete engine + its check together). |

---

## Not debt (hypotheses checked and cleared)
- **"Two cockpit builders"** — `lib/cockpit/analyze.ts` is the single analyzer; `from-store.ts` and
  `google/cockpit.ts` are adapters that call `analyzeAccount()`. Intended source-agnostic seam (Charter §59-60). KEEP.
- **`lib/causality.ts`** — single canonical file (no `lib/scoring/causality.ts`); imported by `decision.ts`,
  `cockpit/analyze.ts`, `rules/verdict.ts`. Not duplicated.
- **`lib/creative/diversity.ts` vs `lib/rules/diversity.ts`** — different layers (primitive vs rule wrapper),
  documented cross-reference in `lib/rules/diversity.ts:3`. Not a duplicate; left as-is pending deeper Batch-B read.
- **`kpi-catalog.ts` (2442 lns)** — a data catalog (162-KPI set), not logic. Size is inherent. KEEP.

## Highest-leverage paydown (per §88)
1. **Delete the two orphan engines + their checks (items 1, 2, 11)** — removes a whole shadow decision path
   and restores the gate's honesty. Smallest, safest, highest-clarity win.
2. **Collapse the three tech-debt/state docs into one (items 7, 8, 9)** — stop the docs contradicting each other.
3. **Label the Google demo path (item 3)** so no one mistakes it for a live integration.
