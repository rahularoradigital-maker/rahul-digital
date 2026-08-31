# AdBrain Media Intelligence Accuracy OS — Gap Map

_The 116-section accuracy spec mapped to the REAL codebase. Principle (spec §1, §99, §113): reuse, don't
rebuild; never fabricate; HOLD on insufficient evidence. Labels use the spec's own §3 evidence tiers where
useful. Honest: this is a multi-quarter rigor program; ~half already exists, the rest is phased below._

## What already exists (reuse — do NOT rebuild)

| Spec section | Already built as | Status |
|---|---|---|
| **§3 Three-Label System (Evidence/Decision/Confidence)** | **`lib/judgment/` — the Triple-Label Judge engine** (Evidence gates × Agreement N/3 × Confidence tier), deterministic core, traced to the 1,061-rule corpus | ✅ **this is §3** |
| §1 no false precision / HOLD on thin data | Materiality gate (no fatigue verdict <20% ad-set spend) + volume sufficiency + settled-tail; engine returns INSUFFICIENT | ✅ |
| §4–5 source of truth + data contract | Meta = authoritative; store w/ account attribution; headline from account total; ~99.99% Ads-Manager match (verified) | ✅ (metadata partial) |
| §13–19 Money-bleed waterfall + counterfactual | `lib/scoring/culprit.ts` (diagnoseCulprit: drop → material stopped contributor, attributed on the metric that dropped) + waste rollup | ✅ partial (no full CPA log-decomposition §16) |
| §21–27 Creative fatigue (multi-signal, temporal) | `lib/scoring/fatigue.ts` (day-wise, state machine fresh→fatigued, trajectory, sufficiency) | ✅ partial (cause-classification §26 partial) |
| §28–31 Half-life | `halfLifeDays` (days to fatigue floor) on scored ads | 🟡 partial (no CI / model choice / obs-count §31) |
| §32–40 Creative diversity | `lib/creative/diversity.ts` + fingerprint + vs-competitors | 🟡 partial (no 3-way portfolio/strategic/executional split §35, no fragility §40) |
| §44–50 Account analytics + 2nd/3rd-order | Funnel diagnosis (TOF/MOF/BOF, weakest step), culprit 2nd-order, decision engine "why" | 🟡 partial |
| §51–52 Recommendation w/ WHY + KNOW/THINK/RECOMMEND | Verdict cards carry why + confidence + triple label | 🟡 partial (not the full §110 15-field contract) |
| §65–68 small-sample / outlier protection | Volume sufficiency + materiality; day-wise robustness | 🟡 partial (no empirical-Bayes shrinkage §67) |
| §89, §99 versioning / reproducibility | Judgment corpus versioned; audit_log; AI cost + task attribution | 🟡 partial (no systematic formula-version stamp on every output) |
| §90–92 fixtures / property tests | ~90 `check:*` scripts incl. property-style invariants (culprit, materiality, funnel) | 🟡 partial (not the named golden-fixture set §90) |

**≈ half the 116 sections are Built or Partial.** The engine already refuses to fabricate and HOLDs on thin
data — the hardest cultural part is done.

## The real gaps (ranked by leverage)

1. **§53–56, §88 — AI Critic (adversarial second opinion).** MISSING. The engine is deterministic + an
   optional AI *narrator*; the spec wants an AI that tries to **disprove** each verdict ("could this be
   audience saturation, not fatigue? what confounder? would a $100M buyer act?"). Highest-leverage accuracy
   upgrade — it catches false positives the math misses. Reuses the AI layer + the judgment engine.
2. **§110 — Final Output Contract.** Standardize every intelligence output to carry all 15 fields (status,
   primary/secondary finding, economic impact, 2nd/3rd-order, evidence label, decision label, confidence, data
   freshness, sample size, **what could be wrong**). Partial today; make it a typed contract every module fills.
3. **§8–12 — Structured Account Health Score.** A dimensioned score (Efficiency/Creative/Funnel/Allocation/
   Scalability/Stability), economically weighted, with a **diagnostic vector** + confidence — not an average.
   Partial building blocks exist; the assembled, versioned health score is missing.
4. **§6, §93–94 — Double-calculation + source reconciliation + drift alerts.** Two independent paths per
   critical metric, compared, flagged on drift; periodic AdBrain-vs-Meta reconciliation. Meta-accuracy work
   exists; the formal dual-path + drift alert is missing.
5. **§35/§40 diversity split + fragility; §16 CPA log-decomposition; §67 shrinkage; §31 half-life CI.**
   Targeted rigor upgrades to existing engines.

## Phased path

- **Phase A (highest leverage, reuse-heavy):** AI Critic (§53–56) over the existing Judgment verdicts; the
  §110 typed output contract; systematic formula-version stamping (§99) into the existing audit log.
- **Phase B:** structured account-health score (§8–12); double-calc + reconciliation + drift (§6/§93/§94);
  golden fixtures (§90).
- **Phase C:** diversity 3-way + fragility (§35/§40); CPA log-decomposition (§16); empirical-Bayes shrinkage
  (§67); half-life CI + model selection (§31).

## Recommended next build

**The AI Critic (§53–56).** It directly serves the spec's #1 rule (no false conclusions): after the
deterministic engine produces a verdict + evidence package, an AI is prompted to **refute it** — name the
strongest alternative explanation, the missing evidence, the confounder — and if it finds a material flaw, the
verdict is **downgraded or flagged**, never silently rewritten (§55: AI must not override the numbers). Fully
reuses the judgment engine + the AI layer; deterministic truth stays authoritative.

---

_Reality check (spec §1): the value here is not more scores — it's fewer false conclusions. Most of the
accuracy culture (HOLD on thin data, materiality, triple label, no fabrication) is already enforced in code.
The gaps are adversarial review, a uniform output contract, and formal reconciliation — build those next._
