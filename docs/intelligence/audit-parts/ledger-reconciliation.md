# Ledger Reconciliation (Phase 0, read-only) — 2026-09-01

Charter §1/§2/§7/§8. Source-of-truth read IN FULL: `FEEDBACK-LEDGER.md`, `docs/PROJECT-LEDGER.md`,
`docs/RAHUL-REQUESTS-LEDGER.md`, `docs/DECISIONS.md`, `docs/10x-audit-and-plan.md`,
`docs/FORMULA-RIGOR-AUDIT.md`, `docs/ai-audit-architecture.md`, `docs/audit-state.json`,
`docs/audits/*`, `docs/intelligence/MASTER-CHARTER.md`, plus user auto-memory. No code changed.
Each rule is phrased as one binding line and deduped across sources; citations in brackets.

---

## A. Standing rules / operating contract (deduped, binding)

1. **Live-verify before claiming done** — reproduce the change in the deployed app on Rahul's real signed-in account; `code-verified` ≠ `live-verified`. [FEEDBACK A1/A3; RR §0; Charter §1/§82; memory]
2. **Verify to 100% before claiming; plan first; cross-check every edge case** (devil's advocate before "complete"). [FEEDBACK A2; RR §0; Charter §135; memory]
3. **Never show a number not derived from a stated rule/formula on real data** — no fabricated dates, counts, or links. [PROJECT-LEDGER §0; RR §0; Charter §5]
4. **Prefer UNKNOWN / INSUFFICIENT / HOLD over a confident wrong answer; failures stay observable** — never turn failed calc→0, failed data→empty-truth, sync-failure→success. [Charter §5/§128-130]
5. **Zero footprint of the former collaborator / sibling-product names** anywhere in code, docs, DB, or UI. [PROJECT-LEDGER §0; RR §0; memory: sibling-product-name-ban]
6. **Every deliverable ships as a downloadable file**, not just inline text. [FEEDBACK A5; memory]
7. **Report with confidence colours 🟢/🟠/🔴; end every session with a plain-English Q&A table.** [FEEDBACK A6; memory: session-end-qa-table, reply-format-listicle]
8. **Every fix goes in a shared code path for all future users** — never a per-account one-off. [FEEDBACK A7]
9. **Finite plans with finish lines; do the one thing asked, prove it live, stop** — no unrequested building. [FEEDBACK A4; RR §0]
10. **Deterministic calc before AI; AI must never silently own financial truth, metrics, isolation, permissions, or source truth.** [Charter §2/§68-72]
11. **Root cause before symptom** — fix the shared function once, not per caller. [Charter §2; ponytail]
12. **Delete before add; reuse existing code/rule/model; no feature without a decision it improves.** [Charter §88-89/§153]
13. **No auto-apply to live ad accounts** — recommendations stage only; owner confirms the change in Meta. [DECISIONS D12]
14. **Account's own data dominates; no hard-coded universal benchmarks** — external figures are priors only, never promoted to hard rules without validation. [Charter §18; DECISIONS D14]
15. **Tenant isolation on every private read/write/cache/job** — scoped to user/org/brand/account/window. [Charter §80-81; FEEDBACK B19/B20]
16. **Trust-UX invariants:** no score without decomposition, no ranking without sample, no fatigue without time, no winner without delivery, no forecast without uncertainty, no alert without actionability. [Charter §90-99]
17. **Stack is fixed:** Next.js + Supabase + Vercel + Gemini (all-Google; Claude dropped). [DECISIONS D2/D6]
18. **Every deterministic formula carries one runnable check; `check:all` + `next build` + `tsc` must be green before publish.** [FORMULA-RIGOR; ponytail; RR §5]
19. **Any formula change must update `FORMULA-RIGOR-AUDIT.md`; every constant is sourced or frozen-and-documented** (a constant that drifts is a bug). [FORMULA-RIGOR §3]
20. **Reconcile docs vs code as MATCH/DRIFT/UNKNOWN; never silently rewrite docs to match broken code.** [Charter §8]
21. **Keep the ledgers + MEMORY updated after every change.** [RR §0; PROJECT-LEDGER footer; memory]
22. **Ship under our own brand (AdBrain), never a real company's identity (deepsolv).** [DECISIONS D4]
23. **North star = economic contribution, not vanity ROAS; no recommendation without economic context.** [Charter §61/§91]
24. **Flag risks with a devil's-advocate pass + 5-year-fitness check; never codify a band-aid as a permanent rule.** [memory: devils-advocate-5yr, devils-advocate-own-work]

Count: **24 standing rules extracted.**

---

## B. Open commitments / unfinished items / known blockers

### Rahul-side (config, cannot be done from code)
- **C1 — set `CRON_SECRET` in Vercel** → activates nightly sync + cache pre-warm + day-wise/metadata sync. Until set, the daily job never runs. [FEEDBACK C1; RR §3; SYSTEM-MAP §2]
- **C2 — connect Shopify** → unlocks real MER / nCAC / contribution ROAS (today BLOCKED, shown UNKNOWN). [FEEDBACK C2; 10x Part A]
- **Sentry DSN, production SMTP, custom domain/DNS, backup-restore drill, load test, enable Google OAuth provider in Supabase.** [FEEDBACK B23/B24/B26]

### Product gaps still open
- **Creative → Diversity "format = Unknown" for all ads** — own-ad deterministic fingerprint not populating in production. [FEEDBACK Part D; RR §4]
- **Cold-pull 504** on Vercel Hobby first fully-cold cockpit load (mitigated only by a warm cache = C1). [FEEDBACK Part D]
- **Gated "coming soon": Brand Brain, Concepts, semantic Diversity, Market → Voice** — decision pending: build (shared Gemini decoder) or remove placeholders. [FEEDBACK Part D; RR §3]
- **Influencer Hunt still has user-scoped reads** (tenant-isolation next slice); **member-invite UI** and **membership RLS** not built. [FEEDBACK B20/B24/B29]
- **9-stage competitor-diagram coverage report** (owner wants it every 6-7 pushes) — pending. [RR §13/14]
- **Formula #13 concept-scoring white-space + historical-performance = 🔴 placeholder** ("honest neutral constants"); **#9 per-benchmark sourcing = 🟠**. [FORMULA-RIGOR §Status]

### Charter Phase-0 deliverables NOT yet produced (verified missing on disk)
- `docs/intelligence/BUSINESS-LOGIC.md` (deliverable #4), the column-level **data-flow map** (#3).
- `docs/intelligence/500-LOGIC-INVENTORY.md` (#17) + the **decision register** with rule IDs (Charter §11).
- The five master libraries (Charter §102-106): `DECISION-LIBRARY.md`, `FORMULA-LIBRARY.md`, `SIGNAL-LIBRARY.md`, `RECOMMENDATION-LIBRARY.md`, `UNKNOWN-LIBRARY.md`.
- `REGRESSION-LOG.md` (Charter §73/§146; PHASE-0-AUDIT-PLAN reuse map says "create if missing").

**Top-3 most important open commitments:** (1) C1 `CRON_SECRET` — without it the whole freshness/scale story is inert; (2) own-ad creative fingerprint so Diversity stops reading "Unknown"; (3) close the Phase-0 deliverable set (BUSINESS-LOGIC + 500-logic inventory + decision register) that the charter makes a precondition for Phase 1.

---

## C. Doc-vs-code DRIFT candidates (to verify, not silently fix — Charter §8)

1. **`audit-state.json` line counts are stale.** Says `lib/meta-source.ts` = 606 lines and only 2 large files / 185 source files. Actual today: `meta-source.ts` = **1120**, `meta-sync.ts` = **737**, `kpi-catalog.ts` = **2442**; `lib/` alone holds **215** `.ts`. Generated 2026-08-28; regenerate or delete. [audit-state.json vs `wc -l`]
2. **DECISIONS D6 implementation note is stale (resolved).** It states the Gemini swap is "NOT yet applied … code still uses Claude (`lib/anthropic.ts`, `app/api/health/claude`)." Both paths **no longer exist**; the app runs on Gemini. `docs/tech-debt.md` items 4 ("provider drift code=Claude") and 10 ("dead Claude SDK") are likewise resolved-but-still-listed. [DECISIONS D6; ls: no such file]
3. **`docs/tech-debt.md` describes a pre-build era** ("a few hundred lines of code", "only 2 checks today"). Reality: 116 `check:*` scripts, ~39k LOC, 215 lib files. The register is superseded (see `TECH-DEBT.md`). [docs/tech-debt.md]
4. **Custom date range: contradictory status.** PROJECT-LEDGER items 6 & 24 mark custom date range 🔴 / a batch-2 note adds an `adbrain.window` cookie, yet FORMULA-RIGOR #2 and SYSTEM-MAP §2 both state a **fixed app-wide 90-day `COMPARISON_DAYS`** window (`WARM_WINDOWS=[90]`). Verify whether the window selector is live or overridden by the fixed baseline. [PROJECT-LEDGER; FORMULA-RIGOR #2; SYSTEM-MAP §2]
5. **Two decision engines / two data-quality engines.** Docs (10x-audit, FORMULA-RIGOR) treat `lib/scoring/decision.ts` + `lib/scoring/data-quality.ts` as canonical, but orphaned `lib/decision.ts` + `lib/data-quality.ts` still exist and still pass gate checks — no doc states which is authoritative. [see TECH-DEBT #1/#2]
6. **Sibling-name-ban footprint risk in docs.** PROJECT-LEDGER §4 and item 22/41 reference a spec filename rendered as `docs/the sibling product-spec.md`. Confirm no on-disk file or string carries the actual banned name (Rule 5). [PROJECT-LEDGER §1 item 22, §4]
7. **"1061-rule corpus" ≠ the §11 decision register.** `lib/judgment/*` corpus is a judgment/agreement engine; the charter's per-recommendation rule register (FATIGUE-001 style, with inputs/calc/failure/test) is a separate, unbuilt deliverable. Docs sometimes conflate them. [RR §5; Charter §11]
8. **Brand naming drift AdScale→AdBrain** — residual "AdScale" strings remain, mostly in code comments and in `lib/judgment/rules.json` / `lib/blog/curated-articles.json`. Cosmetic; confirm none are user-visible. [grep; memory: adbrain-seo]

> Note (hypothesis correction): the prompt's "two cockpit builders" is **not** confirmed as debt.
> `lib/cockpit/analyze.ts` is the single analyzer; `lib/cockpit/from-store.ts` and
> `lib/google/cockpit.ts` are source adapters that both call `analyzeAccount()`. That is the
> intended source-agnostic seam (Charter §59-60), not a competing build.
