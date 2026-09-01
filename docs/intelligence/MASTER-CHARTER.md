# AdBrain — Master Intelligence Charter (BINDING)

Source: Rahul, 2026-09-01. This is the permanent operating charter for AdBrain: how the product
must reason, how logic is discovered/validated, and how the system must be audited before it grows.
It sits alongside `CLAUDE.md` Rule #1 (the Build Loop) and Rule #2 (the Decision Chain) and the
`adbrain-engineering-os` skill. Standing rules here are binding unless Rahul explicitly changes them.

Governing stance: **build the most TRUSTWORTHY decision system, not the smartest-looking analytics
system.** Not a dashboard, not a Meta reporting tool, not a chatbot. The target: "a decision system
that knows what it knows, knows what it doesn't know, and consistently makes better decisions than a
competent human working from disconnected dashboards." Think like a 2021 engineer (AI is an
accelerator, not a substitute for fundamentals).

## Canonical source of truth (§1)
The Feedback Ledger (`FEEDBACK-LEDGER.md`) is a permanent product+engineering contract; read it before
deciding. Its standing rules are binding: live-test before claiming done; verify before confidence;
code-verified != live-verified; finite plans with finish lines; downloadable deliverables; confidence
colours; fixes shared for all future users.

## Founder principles to internalise (§2)
Accuracy before convenience. Evidence before claims. Root cause before symptom. Real account data
before generic benchmarks. Explainability before cleverness. Deterministic calc before AI. Future-user
fixes not one-off patches. Live verification not local confidence. Finite plans not endless building.
Commercial impact not feature count. Simple systems not needless abstraction. 2nd/3rd-order thinking.
Explicit uncertainty not fake precision.

## Absolute-accuracy principle (§5)
Do not promise omniscience. Build 100% traceability, reproducibility, explicit assumptions, visible
uncertainty, source lineage, and deterministic calculation where possible. The system must be
comfortable saying: UNKNOWN / INSUFFICIENT DATA / STILL SETTLING / CONFLICTING SOURCES / LOW
CONFIDENCE / HOLD — always preferable to a confident wrong answer.

## The Master Loop (§6)
DISCOVER -> MAP -> RESEARCH -> MEASURE -> CHALLENGE -> TRACE -> MODEL -> PLAN -> IMPLEMENT -> TEST ->
ADVERSARIAL TEST -> DEPLOY -> LIVE VERIFY -> MEASURE -> COMPARE -> DOCUMENT -> LEARN -> UPDATE SYSTEM
KNOWLEDGE -> REPEAT. Never skip the middle because a change looks simple.

## Discovery, research, classification (§7-§20, §101, §137-§160)
- Audit the WHOLE repo + all canonical docs, not just recently-changed files (§7).
- Reconcile docs vs real code: MATCH / DRIFT / UNKNOWN; never silently rewrite docs to match broken code (§8).
- Build/extend SYSTEM-MAP.md (source->ingestion->db->normalization->calc->decision->AI->UI->action->outcome, + failure paths/caches/queues/cron/APIs/auth/RLS/tenancy) (§9).
- Build/extend BUSINESS-LOGIC.md: per metric — definition/source/formula/assumptions/threshold/comparison set/date window/timezone/currency/sample req/confidence/failure modes/tests/version (§10).
- Build a Decision Register: every recommendation gets a rule ID (FATIGUE-001 etc.) with purpose/inputs/calc/logic/output/confidence/failure cases/test cases/rationale/version (§11).
- 500-LOGIC DISCOVERY (§12): DISCOVER >=500 candidate rules first (do NOT implement them). Inventory in `docs/intelligence/500-LOGIC-INVENTORY.md`, organised by the ~70 named domains.
- Research to inform, not invent (§13). Source hierarchy T1 official platform/first-party -> T5 anonymous (§14). Never promote T4/T5 to hard rules without validation.
- Every candidate rule carries an EVIDENCE LEVEL A/B/C/D (§15) and a FUNCTION type (diagnostic/predictive/prescriptive/alerting/descriptive/scoring/filtering/ranking/forecasting/experimental) (§16). Never ship C/D as hard truth. Don't mix function types.
- Logic Card format (§17): ID/name/question/purpose/inputs/source/formula/assumptions/comparison set/min sample/window/output/evidence level/confidence/FP risk/FN risk/2nd-order/3rd-order/what-could-make-it-wrong/test/impl cost/business value/status.
- Prioritise (§101): (Economic Impact x Frequency x Confidence x Actionability x Learning Value) / Impl Cost -> BUILD NOW / BUILD NEXT / SHADOW / RESEARCH / DEFER / REJECT. Do NOT build all 500 (§159); the inventory is the discovery surface, the best subset becomes the product.
- Hard research/product boundary (§137): research = hypotheses/priors/benchmarking; account data decides account-specific calls. Don't overfit one account (§138) or underfit obvious context differences (§139). Record rule scope: global/category/brand/account (§140).

## Benchmarks & statistics (§18-§20, §92, §116-§117)
- No hard-coded universal benchmarks (§18). Prefer account/objective/campaign/peer/spend-weighted/time-aware baselines; external benchmarks are priors, the account's own data dominates once sufficient.
- Statistical discipline (§19): always ask sample size/denominator/variance/outliers/window/selection & survivorship bias/completeness/confounders/multiple comparisons/regression-to-mean/Simpson's paradox.
- Bayesian/shrinkage (§20): evidence-weighted estimates; 1 purchase at 15x ROAS must not outrank 100 purchases at 5x. Keep implementation simple unless complexity earns its keep.
- No ranking without sample context (§92). Benchmark account-vs-itself and vs relevant peer set (§116); peer sets by industry/spend/objective/business model/market/creative maturity (§117).

## Core diagnostic engines (§21-§54, §123-§127)
- Account Health (§21-§22): audit components/weights/normalization/account-relative logic/spend weighting/sample/confidence/missing-data/windows/edge cases/monotonicity/stability; backtest before changing. Must decompose (efficiency/creative/funnel/allocation/stability/risk/data quality) + primary reason/secondary/top strength/top risk/confidence.
- Money Bleed (§23-§27): counterfactual — Avoidable Loss = Expected - Actual, only when baseline valid + sample sufficient + fair comparison; track gross gap / confidence-adjusted gap / exposed spend / avoidable gap; never present the whole gap as recoverable. Decompose CPA ~= CPM/(CTR x LPV x CVR); don't call all CPA deterioration "fatigue". 2nd/3rd-order bleed as inference/hypothesis, labelled.
- Creative Fatigue (§28-§30): a temporal STATE, not one metric. State machine UNKNOWN/HEALTHY/EARLY_WARNING/DEGRADING/FATIGUED/SEVERELY_FATIGUED/RECOVERING with evidence-gated transitions (no one-day collapse). Cause engine distinguishes fatigue vs audience saturation vs auction vs offer vs LP vs conversion vs tracking vs mix shift vs budget shock vs seasonality vs unknown. Purpose = diagnosis, not labelling.
- Creative Half-Life (§31-§32): audit definition/decay model/peak/baseline/noise/near-zero protection/slope stability/censoring/min history. Handle right/left-censoring + insufficient history; if not enough info -> HALF-LIFE UNKNOWN, never invented.
- Creative Diversity (§33-§36): strategic vs executional vs format/hook/angle/offer/audience/visual-mechanism. RAW vs EFFECTIVE diversity (spend/impressions/delivery/active-state weighted). Concentration via HHI/entropy/spend-share/conversion-share. Portfolio Fragility score with evidence.
- Winners/Losers (§37-§39): classify winners (proven/emerging/high-eff-low-scale/high-scale-declining/fragile/learning/inconclusive); no "loser" without fair test pool + sufficient spend + valid attribution; test-pool quality is a first-class diagnostic variable.
- Creative testing/whitespace/next-creative (§40-§43): represent concept/angle/hook/format/execution/offer/audience/hypothesis; find whitespace (angle x hook etc.); next-creative outputs concept/angle/hook/format/why-now/gap/evidence/expected learning/upside/risk/confidence, traceable to performance -> closed-loop Studio.
- Account diagnostic hierarchy (§44): DATA HEALTH -> ACCOUNT HEALTH -> ALLOCATION -> CAMPAIGN -> FUNNEL -> PORTFOLIO -> FATIGUE -> DIVERSITY -> SCALABILITY -> NEXT ACTION. Don't jump to ad-level without account context.
- Funnel (§45-§46): per stage conversion/relative change/baseline/economic exposure; largest MEANINGFUL leak, not lowest %; classify leak cause; don't blame the ad for a checkout failure.
- Scaling (§47-§49): don't scale on high ROAS alone; check marginal efficiency/spend level/volume/fatigue/creative capacity/replacement/audience/margin/inventory/history/trend. Measure scale elasticity + diminishing returns. Detect budget shocks before attributing deterioration to creative.
- Change Impact (§50): correlation-with-controls, before/after/settled, objective-specific, sufficiency-gated (preserve existing philosophy). Media-buyer intelligence (§51) ranks by measured change impact, not account ROAS.
- Risk / anomaly / early warning (§52-§54): risk dimensions (concentration, single-product/channel dependence, tracking, freshness, margin, inventory, platform); anomaly detection prioritised by economic impact/confidence/actionability; leading indicators labelled prediction, not fact.

## Data trust, reconciliation, semantics (§55-§60, §128-§132)
- Data Health score per account (§55): missing days/ads, source mismatch, stale sync, dupes, unexpected zeroes, attribution/timezone/currency mismatch; affects downstream confidence.
- Reconciliation (§56-§58): compare sources, record diff/likely reason/canonical interpretation/confidence; don't force agreement. On conflict ask "what does each source MEASURE?" — reconcile semantics first. Every metric defines gross/net, attribution, date basis, currency, timezone, refund/discount/tax treatment, source.
- Failure must stay observable (§128-§130): never turn failed calc->0, failed data->empty truth, AI failure->fake answer, sync failure->success. Reconciliation failure -> downgrade confidence or HOLD; never silently pick the nicer number. Stale results are visibly stale.
- Freshness/versioning (§131-§132): recommendations carry generated_at/data_as_of/valid_until; store rule/formula/model/prompt/taxonomy versions; historical results reproducible.

## Economic truth (§61-§67, §91)
North star = economic contribution = revenue - variable product costs - fulfillment - refunds -
discounts - fees - ad spend - other variable acquisition. Use real connected sources; don't guess
missing costs. Define new-customer/attribution/window before nCAC (§62); define denominator before MER
(§63); contribution ROAS only where margin exists, never labelled standard ROAS (§64). Respect inventory
(§65). 2nd/3rd-order business thinking (§66-§67): scale -> stockout/refunds; cheap acquisition -> low
LTV masked by ROAS. No recommendation without economic context (§91).

## AI discipline (§68-§72, §100, §107, §113)
AI may interpret/challenge/summarize/classify/hypothesise/generate/explain; it must NOT silently own
financial truth, metrics, isolation, source truth, permissions, or deterministic calc (§68). Adversarial
review: deterministic engine emits an evidence packet, AI critic tries to disprove; AI disagreement !=
engine wrong (§69). Measure AI calls/tokens/retries/fallbacks/cost/cache; prefer fingerprint-once, reuse,
batch, cache, deterministic preprocessing (§70). Hierarchical context, not the whole DB (§71). AI memory
never overrides current source data (§72). No AI call without a reason rules/SQL/lookup/cache can't serve
(§100). Learning from action+outcome+repeated evidence, not raw approval/dismissal (§113).

## Testing, tenancy, scale, performance (§73-§88, §133-§136, §146-§152)
- Regression learning (§73, §146): every bug -> root cause -> fix -> test -> rule -> doc -> guardrail, and into REGRESSION-LOG.md + a golden fixture. Never solve the same edge case twice.
- Logic lifecycle (§74-§75): DISCOVERED -> HYPOTHESIS -> OFFLINE TEST -> SHADOW -> REVIEWED -> PRODUCTION -> MONITORED -> RETIRED/UPDATED. Shadow-run a new critical formula beside the old, compare, promote only after review.
- Golden accounts/decisions (§76-§77) across size/spend/volatility/maturity/multi-brand; golden decisions with expected conclusions (healthy/fatiguing/false-fatigue/true-bleed/false-bleed/tiny-sample/etc.).
- Formula property tests (§78): invariants (CTR<=100%, counts>=0, spend>=0, ROAS/CPA definitions) + zero/null/missing/duplicate/late/timezone/currency.
- Data completeness (§79): unknown != zero; not-connected != zero; not-enough-history != healthy.
- Account-scope safety + tenant isolation (§80-§81): every rule verifies user/org/brand/account/window; every private read/write/cache/job scoped. A correct formula on the wrong account is still wrong.
- Live verification (§82): every user-visible calc change -> deploy + prod verify + real-account test + one edge + one failure case, before "fixed".
- Performance/precompute (§83-§84): every rule has a cost model; compute during sync where possible, not per page load.
- Scale (§85-§87, §147-§152): reason at 100->100k ads and 10->10k users; 10x questions; the 2021 test (works without AI?). Pipelines must resume/continue-after-timeout/retry/partial-success/skip-completed (the 1,034-ad sync lesson). Large-account model (2k-10k ads) — no single request/SQL/prompt/array. Caches define key/scope/TTL/freshness/invalidation/bound/stampede/failure; queues define id/tenant/priority/status/attempt/backoff/timeout/idempotency/checkpoint/error/timestamps; expensive processes have a cost model.
- Delete before adding (§88, §153): reuse existing code/rule/model; one calc serving three modules; simplification is a feature. No feature without a decision it improves (§89). Safe migrations with rollback (§133). Release gate GREEN (§134) = build/typecheck/lint/tests/critical checks/regression fixtures/security/formula checks/prod smoke/live verify. Devil's advocate before "complete" (§135) across wrong-date/account/tiny/huge/zero/null/missing/dup/stale/concurrent/API-failure/paused/deleted/changed. Change review (§136): actual bug? cause fixed? sibling paths? new assumption? complexity/perf/cost/tenant impact?

## Output & trust UX (§90-§99, §120-§127, §160)
No score without decomposition (§90). No recommendation without economic context (§91). No ranking
without sample (§92). No fatigue without time (§93). No diversity without meaning — semantic fingerprints
(§94). No "winner" without delivery (§95). No "loser" without test context (§96). No causality without
design (§97). No forecast without uncertainty (§98). No alert without actionability (§99). Every major
feature answers WHAT/WHY/WHERE/HOW MUCH/HOW SURE/WHAT NEXT/WHAT COULD MAKE THIS WRONG (§120). Plain
English + "show calculation" drill-down summary->evidence->calc->raw source (§121-§127). Ultimate
standard (§160): what we know / think / don't know / why / how much money / what to do / do-nothing vs
act / what could prove us wrong / confidence.

## Rule conflicts & signal logic (§141-§145)
Rule conflicts resolved by priority/evidence/confidence/scope, explained, never silent (§141). Confidence
rises when independent signals agree (§142); conflicting signals (CTR down but CVR up, ROAS stable) ->
explain, don't auto-call fatigue (§143). Trend tools (rolling median/EWMA/slope/change points/robust
regression) only where justified (§144). Never let tiny numerator/denominator/single day/one conversion
dominate a trend — the half-life tiny÷tiny bug is the canonical lesson (§145).

## Taxonomy, moat, evolution (§108-§119, §154, §161)
Continuous research -> RESEARCH EVIDENCE, validated against real data before becoming product truth
(§108). Detect platform changes; detect->research->measure->shadow->update, don't auto-rewrite (§109).
Monthly product-evolution review (§110). The moat = historical evidence + decision quality +
brand-specific learning + creative intelligence + cross-channel context + economic understanding +
outcome feedback (§111). Product learning loop STATE->EVIDENCE->DIAGNOSIS->ACTION->OUTCOME->LEARNING as
institutional memory (§112). Track FP/FN rates + decision quality/value created (§114-§115). Canonical
versioned creative taxonomy (§118-§119). Final goal: senior media team + analyst + creative strategist +
CFO + reliable software — auditable/explainable/measurable/controllable (§154). Maximise correct
decisions/economic value/learning/speed/reliability/explainability, not features/scores/AI-calls (§161).

## Master libraries to build (§102-§106)
`docs/intelligence/DECISION-LIBRARY.md`, `FORMULA-LIBRARY.md`, `SIGNAL-LIBRARY.md`,
`RECOMMENDATION-LIBRARY.md`, `UNKNOWN-LIBRARY.md` (track what we cannot yet know).

## Phase structure & finish lines (§155-§158)
Phase 0 Discovery (no major coding; produce the 20 audit deliverables below). Phase 1 Correctness
(wrong numbers/scope/formulas/attribution/freshness/isolation/classifications). Phase 2 Diagnostics
(health/bleed/funnel/fatigue/diversity/half-life/winner-loser). Phase 3 Decision Intelligence
(2nd/3rd-order, counterfactuals, portfolio risk, next-action). Phase 4 Learning (decision->action->
outcome->learning). Phase 5 Scale (request->background, rollups/queues/precompute/concurrency). Phase 6
Cross-platform (Google/Shopify/Triple Whale canonical model). Phase 7 Advanced (forecasting/incrementality/
optimization) only after foundations proven. Every phase states START/SCOPE/FILES/EXPECTED OUTPUT/TESTS/
LIVE TEST/SUCCESS CRITERIA/STOP CONDITION. Priority P0 correctness/security/data-integrity, P1 high-impact
diagnosis, P2 performance/scale, P3 sophistication.

## Phase 0 required deliverables (§155) — see PHASE-0-AUDIT-PLAN.md
1 Full codebase audit · 2 Architecture map · 3 Data-flow map · 4 Business-logic map · 5 Formula
inventory · 6 Decision inventory · 7 Failure-mode inventory · 8 Tech-debt inventory · 9 Performance
bottlenecks · 10 Security risks · 11 Data-quality risks · 12 AI risks · 13 Creative-intelligence risks ·
14 Tenancy risks · 15 Scale risks · 16 SEO/public-site risks · 17 500+ candidate logics · 18 Logic
prioritization matrix · 19 Proposed phase plan · 20 Release/verification plan. Do not hide unfinished work.
