# [13] White Space Framework

The map of **where the next winner could live**. It crosses OUR creative universe against the
COMPETITOR creative universe across fingerprint dimensions (persona / problem / desire / awareness /
hook / angle / concept / format / visual / speaker / product / offer / message / landing / CTA), and
resolves every region of that map to a **decision**: diversify, differentiate, test-adopt, protect,
explore, or leave alone.

This is a **decision** artifact, not a reporting one. It answers the brief's final-test question
*"where is the white space?"* and, one step further, *"which white space should we produce next, for
whom, to test what, expecting what signal, at what risk, with what confidence?"*

## Grounding (reconciled 2026-08-25)

Written against and consistent with the canonical foundations:

- **`brief.md`** — *"Map our creative universe vs competitors'; find unoccupied combinations.
  Competitor data (Ad Library/Apify/ScrapeCreators) generates HYPOTHESES not conclusions; active ad
  != winning ad. Competitor economics = UNKNOWN."* Also the diversity charter (score family:
  Diversity, Concentration, Redundancy, **White-Space**, Coverage) and *"insufficient data != waste."*
- **`00-master-plan.md`** — decision gate, fact labeling, level-aware, time-aware, confidence +
  explainability, never fabricate.
- **`02-meta-data-mapping.md`** — source class per input: competitor creatives/copy/format/longevity
  = **EXTERNAL** (Ad Library / ScrapeCreators, "active != winning"); competitor spend/results =
  **CANNOT-KNOW** ("UNKNOWN — never present as fact"); our persona/hook/angle/concept labels =
  **INFER** (INFERENCE with confidence); spend = **FETCH OFFICIAL**; embeddings = **EXTERNAL/CALC**.
- **[01c] I-Diversity, esp. I4 White-Space Score** — this framework **operationalises I4**; the score
  definition below is the expanded, buildable form of that dictionary entry (no redefinition, same
  class and fact label).
- **[01d] L-Competitive** — the competitor-universe inputs (L1 active count, L2 longevity, L4 format
  mix, L5 messaging/angle themes) are the raw material for the competitor side of the map.

**Builds on (forward references):** **[05] Creative Fingerprint Spec** supplies the dimension axes and
per-creative fingerprint tags/embeddings; **[12] Competitive Intelligence Framework** supplies the
competitor creative corpus and its tagging. As of this writing 05 and 12 are not yet authored — this
file consumes their *contract* (the fingerprint dimensions from `brief.md`/[01c], the competitor
corpus from [01d] L). If 05/12 change a dimension name or class, reconcile here.

**Source-class legend ([02]):** FETCH = direct Meta API field · CALC = computed from fetched fields ·
INFER = AI-modeled/estimated · EXTERNAL = another system · CANNOT-KNOW = not reliably knowable.
**Fact labels:** OFFICIAL PLATFORM FACT · INTERNAL CALCULATION (DERIVED) · RESEARCH-BACKED · INDUSTRY
BENCHMARK · MODEL ESTIMATE · INFERENCE · UNKNOWN.

**Two honesty rules that govern this entire file:**
1. **active != winning.** A competitor-occupied combination is a HYPOTHESIS, never proof of a winner.
   Competitor economics are UNKNOWN — we never rank a white space by competitor performance, because
   we cannot see it.
2. **unoccupied != opportunity.** An empty combination can be empty because it is *untapped* OR
   because it was *tried and failed* OR because it is *structurally irrelevant* (no audience wants
   it). The framework must distinguish these or the White-Space Score is noise.

---

## 1. The core object: the fingerprint combination

The unit of white-space analysis is a **fingerprint combination** — a point (or region) in the
creative universe defined by a tuple of dimension values.

**Dimensions (axes of the universe)** — from the creative fingerprint ([05] / `brief.md` / [01c] I):

| Tier | Dimensions | Why this tier |
|---|---|---|
| **Primary (drive independent demand + fatigue independence)** | persona, problem, desire, awareness stage, hook, angle, format, offer, product | These change *who* is reached and *why they act*; a new value here can open a genuinely new pocket of demand. Highest weight in the score. |
| **Secondary (execution / differentiation within a pocket)** | concept, message, visual style, speaker, CTA, landing page | These differentiate *how* a pocket is addressed; new values here are refinements, not new demand. |
| **Cosmetic (rarely a demand driver alone)** | background, environment, narrative structure | Included for completeness; near-zero weight unless an account proves otherwise. |

**A "combination"** is a chosen subset of dimensions at a chosen granularity. We do NOT analyse the
full Cartesian product (see §3 — it is combinatorially meaningless). We analyse **combinations of the
primary tier** (e.g. persona × hook × angle × format), with secondary dimensions used to judge
*differentiation* within an occupied cell.

- **Level:** creative / ad, aggregated to account or by-product. Combinations are portfolio-level
  objects.
- **[02] class of the tuple:** dimension tags are **INFER (INFERENCE with confidence)** on our side,
  **EXTERNAL → INFER** on the competitor side (Ad Library creative + our classifier). Every combination
  therefore inherits tagging uncertainty — *a white-space verdict is only as trustworthy as the
  tagging beneath it.*

---

## 2. The territory map (our universe × competitor universe)

Cross **occupancy on our side** (do we run creative in this combination, and how much spend sits
there) against **occupancy on the competitor side** (do tracked competitors run creative here — from
the Ad Library corpus [12]/[01d] L). This yields four mutually-exclusive quadrants plus one intensity
overlay.

|  | **Competitor ABSENT** | **Competitor PRESENT** |
|---|---|---|
| **We PRESENT** | **OUR WHITE SPACE** (our-exclusive territory) | **SHARED TERRITORY** (both run it) |
| **We ABSENT** | **UNOCCUPIED** (true white space — neither runs it) | **COMPETITOR WHITE SPACE** (their-exclusive territory) |

**OUR SATURATION** is not a fifth quadrant — it is an **intensity overlay on the "We PRESENT" row**:
the sub-region where our spend piles into a few combinations (the I2 Concentration face). A cell can be
Shared Territory *and* Saturated for us at the same time.

Each region carries a **default decision** (every region names the decision it drives — decision gate):

| Region | What it means | Default decision it drives | Fact label of the classification |
|---|---|---|---|
| **OUR SATURATION** | We are heavily concentrated here (high spend share, few combos) | **De-risk / diversify** — do NOT add more here; single point of fatigue failure. Feeds [10] waste risk and [07]/[08] fatigue. | INTERNAL CALCULATION (DERIVED) over FETCH spend + INFER tags |
| **SHARED TERRITORY** | Both we and competitors run this pocket | **Differentiate or compete** — crowded pocket; win on execution (secondary dimensions) or reallocate. Not net-new demand. | INTERNAL CALCULATION over INFER (ours) + EXTERNAL/INFER (theirs) |
| **COMPETITOR WHITE SPACE** | They run it, we don't | **Test-adopt (HYPOTHESIS)** — candidate to test; *active != winning*, so validate with a small test, never copy-and-scale. | INFERENCE / HYPOTHESIS (competitor presence is EXTERNAL fact; "worth adopting" is inference) |
| **OUR WHITE SPACE** | We run it, they don't | **Protect or validate** — is it a *moat* (unique + performing) or a *dead zone* (unique because nobody wants it)? Decide protect vs abandon using OUR performance. | INTERNAL CALCULATION over our FETCH+INFER (our performance is knowable) |
| **UNOCCUPIED** | Neither runs it | **Explore (highest uncertainty)** — pursue only *plausible* combos adjacent to proven winners; most unoccupied cells are empty for a reason. | INFERENCE (candidate value is modeled, not observed) |

**Why the asymmetry matters (an honesty point, not a nicety):** on OUR side of the map we can see
performance (spend, ROAS, fatigue — FETCH/CALC), so "our white space" and "our saturation" verdicts
can be grounded in outcomes. On the COMPETITOR side we can see *presence only* (EXTERNAL) and *never
performance* (CANNOT-KNOW). So competitor-derived regions can only ever generate HYPOTHESES to test —
they can never be ranked by how well the competitor is doing, because that is unknowable.

---

## 3. The combination lattice and pruning (the make-or-break step)

The full Cartesian product of all dimensions is astronomically large and mostly meaningless (most
tuples describe creative no sane strategist would make). **An unpruned lattice makes the White-Space
Score garbage** (I4 limitation, verbatim). Pruning is mandatory and happens *before* any score:

| Prune rule | Keep a candidate combination only if… | Class of the judgment |
|---|---|---|
| **Plausibility** | its dimension values are individually *attested* (each value appears somewhere in our corpus or the competitor corpus — we don't invent a hook that no one has ever run). | INFER |
| **Adjacency** | it is within a small edit-distance of a **proven winner** (swap one dimension of a winning combo) OR of a **competitor-active** combo. Distant-from-everything combos are dropped. | CALC (distance) over INFER tags |
| **Coherence** | the tuple is internally consistent (persona ↔ awareness stage ↔ offer make sense together — filtered by a rule/model, not hardcoded). | INFER |
| **Product fit** | at least one product in the catalogue can carry it (ties to [01c] I5 Coverage + product feed, EXTERNAL). | EXTERNAL + INFER |
| **Not-already-failed** | it is NOT in the **learning store** as a tried-and-lost test (checked against the hypothesis→result→learning record — `brief.md` "every test stores hypothesis→result→learning→next-test"). | CALC over EXTERNAL learning store |

- **`ponytail:` naive lattice ceiling** — the first build will prune with a simple attested-values +
  1-dimension-swap-from-winner heuristic (O(winners × dimensions × values)); the upgrade path is an
  embedding-neighbourhood search in fingerprint space ([05]). Ship the heuristic, name the ceiling.
- **When NOT to trust the lattice:** if the pruned candidate set is arbitrary, unpruned, or ignores
  the learning store, every downstream white-space number is meaningless — surface "lattice
  unvalidated" rather than a score.

---

## 4. The White-Space Score (portfolio-level)

This is the buildable expansion of **[01c] I4**. It is the *portfolio* measure — "how much of the
plausible, valuable universe are we NOT occupying." It is distinct from the per-combination
**Opportunity Score** in §5 (which ranks individual candidates to produce). Both are `primary`.

| Field | Value |
|---|---|
| **Measures** | The share of the *pruned, plausible, valuable* candidate universe (§3) that we are **not** currently running creative in. High = large untapped/uncontested surface; low = we already cover the plausible space. |
| **Why it matters** | White space is where the next winner may live; a near-zero score says "stop hunting for net-new pockets, optimise what you have," a high score says "there is room to explore." Directly answers the brief's *"where is the white space?"* |
| **Decision it drives** | **What to produce next** (net-new territory) vs. optimise-in-place. `primary`. |
| **Inputs** | Our occupied combinations (INFER tags + FETCH spend), competitor occupied combinations ([12]/[01d] L, EXTERNAL), the pruned candidate lattice (§3), the learning store of past tests (EXTERNAL/CALC). |
| **Formula** | `White-Space Score = Σ(value_w · unoccupied_w) / Σ(value_w)` over every candidate combination *w* in the pruned lattice, where `unoccupied_w = 1` if we do not run it (0 otherwise), and `value_w` is the candidate-value weight below. I.e. the **value-weighted fraction of the plausible universe we don't occupy.** Report alongside raw unoccupied-count fraction so the weighting is inspectable. |
| **Weights + reason** | `value_w` combines: **(a) adjacency to a proven winner** (highest weight — the most reliable signal that a nearby pocket could work; a swap-one-dimension-from-a-winner combo is the safest net-new bet); **(b) primary-dimension novelty** (a combo that opens a new persona/hook/angle/format pocket is worth more than one that only varies a cosmetic dimension — ties to the I1 dimension weighting); **(c) competitor-active adjacency** (a combo competitors run is a market HYPOTHESIS it has demand — weighted, but *below* our own winners because active != winning); **(d) product/coverage fit** (a combo that fills a real [01c] I5 coverage gap). **Exact weight values are UNKNOWN — calibrate per account at build**; hardcoding them would be an arbitrary threshold (disallowed by `brief.md` rule 5 / [02]). The *ordering* (our-winners > novelty > competitor-active > cosmetic) is the defensible design; the magnitudes are calibrated. |
| **Source / [02] class** | Our INFER tags + FETCH spend + EXTERNAL competitor data + EXTERNAL learning store → **CALC DERIVED**; the "value" judgment on competitor-derived candidates is **INFERENCE**. |
| **Level** | Account / campaign / by-product (choose scope explicitly). |
| **Time window** | Snapshot of the current active set; re-scored weekly and whenever the competitor corpus or portfolio changes. Report the trend (is our white space shrinking as we produce?). |
| **Min sample** | Needs (i) enough tagged history to know what we occupy, (ii) a non-trivial pruned lattice, (iii) a competitor corpus of meaningful size. Below any of these → report **INSUFFICIENT DATA**, not a score. Exact floors **UNKNOWN — verify at build.** |
| **Confidence** | Inherits the weakest input: tag confidence (INFER), competitor-corpus completeness (we only see tracked competitors), lattice validity. Low tag confidence or a thin competitor set → low confidence, stated. |
| **Limitations** | (1) Combinatorially huge → meaningless without §3 pruning. (2) "Empty" may mean "tried and failed" — mitigated only if the learning store is wired in. (3) Competitor side is presence-only (EXTERNAL); we see tracked competitors, not the whole market. (4) Entirely dependent on tag accuracy (INFERENCE). |
| **When NOT to trust** | Lattice arbitrary/unpruned; competitor data treated as proof of a winner; no memory of past failed tests; tag confidence low; competitor corpus tiny or stale. |

- **Fact label:** score = **INTERNAL CALCULATION (DERIVED)**; competitor-derived candidate value =
  **INFERENCE / HYPOTHESIS**, never a fact; competitor economics remain **UNKNOWN** (per [02]).

**Companion portfolio readouts (each names its decision):**

| Readout | Definition | Decision it drives |
|---|---|---|
| **Our-saturation index** | Spend-weighted HHI over occupied primary combinations (= I2 Concentration, reused, not redefined). | Diversify vs. accept a proven concentrated winner. |
| **Shared-territory share** | Fraction of our spend in combinations competitors also run. | How much of our spend is in crowded pockets → differentiate or exit. |
| **Our-exclusive (moat) share** | Fraction of our spend in combinations no tracked competitor runs. | Protect (if performing) vs. abandon (if a dead zone). |
| **Unoccupied-plausible count** | Count of pruned candidate combos neither side runs. | Size of the net-new exploration backlog. |

---

## 5. The White-Space Opportunity object (per candidate — what actually drives production)

The portfolio score tells you *how much* room exists; the operator needs *which specific combos to
produce next*. Each surfaced white space is an **Opportunity object** with the six fields the scope
requires — **why it matters / who it targets / what to test / expected signal / risk / confidence** —
plus a ranking score.

### 5.1 Opportunity object schema

| Field | Content | Class / fact label |
|---|---|---|
| **Combination** | The fingerprint tuple (e.g. persona=X, hook=Y, angle=Z, format=Reels, offer=W). | INFER tags |
| **Region** | Which territory (§2): our white space / competitor white space / unoccupied / shared. | INTERNAL CALCULATION |
| **Why it matters** | The reason this combo could open value: adjacency to a named winner, an uncovered high-priority persona/product, or a competitor-market hypothesis. Must cite the evidence, not assert. | CALC + INFERENCE |
| **Who it targets** | The persona / awareness stage / product it addresses (ties to [01c] I5 Coverage + the strategy target list, EXTERNAL). | INFER + EXTERNAL |
| **What to test** | The concrete testable creative brief: the one dimension changed from the reference winner (or the competitor angle to adapt), stated as a hypothesis. | INFERENCE (hypothesis) |
| **Expected signal** | The leading metric that would confirm/deny early — hook rate / thumbstop / CTR at low spend first ([01a] attention), then CVR/CPA. Names the metric AND the direction, never a fabricated target number. | Points to [01a]/[01b] metrics; any "good = X%" = **UNKNOWN / calibrate at build** |
| **Risk** | What could make this a waste: cannibalises a saturated winner, competitor combo that only *looks* active, cosmetic-only novelty, no product fit, or already-failed in the learning store. | INFERENCE |
| **Confidence** | Composite (see §5.3): tag confidence × adjacency strength × evidence type (our-winner-adjacent > competitor-active > pure-unoccupied). | MODEL ESTIMATE / INFERENCE |
| **Priority action** | DO NOW / DO NEXT / WATCH / DO NOT ACT / NEEDS MORE DATA (`brief.md` action prioritisation), from the Opportunity Score. | INTERNAL CALCULATION |

### 5.2 White-Space Opportunity Score (ranking)

| Field | Value |
|---|---|
| **Measures** | The relative priority of producing a *specific* candidate combination now. |
| **Why it matters** | Turns a large white-space surface into a ranked, finite production backlog the creative team can act on this week — the difference between "there's white space" and "make this next." |
| **Decision it drives** | Which specific creatives to brief/produce next, and in what order. `primary`. |
| **Inputs** | Adjacency-to-winner strength (CALC over embeddings [05]/tags), primary-dimension novelty (CALC), competitor-activity signal (EXTERNAL, HYPOTHESIS only), coverage-gap priority ([01c] I5 + EXTERNAL strategy list), tag confidence (INFER), learning-store status (EXTERNAL). |
| **Formula** | Weighted combination of the inputs → a 0–1 priority, then mapped to the action tiers. Report the component contributions (explainability — the operator sees *why* it ranked high). |
| **Weights + reason** | **Adjacency-to-our-winner** highest (safest evidence a nearby pocket works). **Coverage-gap priority** next (a strategically required, uncovered persona/product is a business mandate, EXTERNAL). **Primary-dimension novelty** next (new demand pocket > cosmetic variant). **Competitor-activity** *positive but capped low* — it is a market hypothesis, and *active != winning*, so it must never outrank our own observed winners. **Tag confidence** is a *multiplier* (low confidence discounts everything). **Learning-store "already failed"** is a hard *penalty/exclusion*. Exact magnitudes **UNKNOWN — calibrate per account at build**; the ordering and the confidence-multiplier / failure-penalty structure are the defensible design. |
| **Source / [02] class** | CALC over INFER tags + FETCH performance + EXTERNAL competitor/strategy/learning → **INFERENCE** (a prioritised bet, not a measurement). |
| **Level** | Combination (creative-brief level); rolls up to a per-account backlog. |
| **Time window** | Re-ranked each snapshot; a candidate's score decays if it sits un-produced while the map shifts. |
| **Min sample** | Adjacency needs at least one qualified winner to anchor on; with zero winners, only coverage-gap and competitor-hypothesis candidates can be scored (flag the weaker basis). |
| **Confidence** | Per-candidate, from §5.3; carried on the object, never hidden. |
| **Limitations** | It is a *prioritised hypothesis*, not a prediction of success; ignores execution quality (a great combo made badly still loses); competitor side is presence-only. |
| **When NOT to trust** | No winner to anchor adjacency; competitor-activity driving the rank (hypothesis, not proof); tag confidence low; learning store not wired (may re-suggest a known failure); cosmetic-only novelty inflating novelty term. |

- **Fact label:** **MODEL ESTIMATE / INFERENCE** with confidence and named drivers; the underlying
  combination existence on the competitor side = **OFFICIAL PLATFORM FACT (Ad Library)** but its value
  to us = **INFERENCE / HYPOTHESIS**.

### 5.3 Per-opportunity confidence (how it's built — no fake precision)

Confidence is **not** a competitor-performance number (that is CANNOT-KNOW). It is built from what we
*can* know:

| Driver | Raises confidence | Lowers confidence |
|---|---|---|
| **Evidence type** | Adjacent to OUR proven winner (we can see it worked) | Pure-unoccupied guess; competitor-only (active != winning) |
| **Tag confidence** | High-confidence fingerprint tags on the reference creatives | Low-confidence / sparse tags (INFERENCE weak) |
| **Corpus completeness** | Rich competitor + own history | Thin/stale competitor corpus; short own history |
| **Coverage mandate** | Fills a named strategic target (EXTERNAL priority) | No product/persona fit |
| **Learning store** | No prior contradicting test | Near-miss to a past failure |

Aligns with the Confidence Framework [14]: data completeness, sample, signal consistency,
cross-signal agreement — no fabricated precision.

---

## 6. Decision-gate summary (every signal → a decision, or it is cut)

| Signal / score | Decision it drives | Action tier it feeds |
|---|---|---|
| White-Space Score (portfolio) | Produce net-new vs. optimise-in-place | DO NEXT / WATCH |
| Our-saturation index | Diversify vs. accept concentrated winner | DO NOW (de-risk) / DO NOT ACT |
| Shared-territory share | Differentiate on execution vs. exit crowded pocket | DO NEXT / WATCH |
| Our-exclusive (moat) share | Protect performing moat vs. abandon dead zone | DO NOW (protect) / DO NOT ACT |
| Unoccupied-plausible backlog | Explore adjacent-to-winner bets only | DO NEXT / NEEDS MORE DATA |
| Opportunity Score (per combo) | Which specific creative to brief next | DO NOW / DO NEXT / WATCH / DO NOT ACT / NEEDS MORE DATA |

Anything here that could not name a decision has been cut per the decision gate. (Cut for discipline:
a raw "number of unoccupied cells" with no value-weighting or pruning — it is a vanity count, meaningless
without §3/§4.)

---

## 7. Adversarial gates (AUTOPSY / KILLCRITIC)

| Gate | Failure it catches here | Guard in this framework |
|---|---|---|
| **AUTOPSY** | "Empty = opportunity" when it is really tried-and-failed or structurally irrelevant | Learning-store exclusion (§3) + plausibility/coherence pruning |
| **AUTOPSY** | Treating competitor presence as proof of a winner | active != winning enforced; competitor side is HYPOTHESIS, capped below our winners (§5.2) |
| **AUTOPSY** | White-space driven by mis-tagged fingerprints | tag-confidence multiplier (§5.3); INSUFFICIENT DATA on low confidence |
| **AUTOPSY** | Suggesting a combo that just cannibalises a saturated winner | saturation overlay flags it as risk (§5.1 Risk) |
| **KILLCRITIC** | Combinatorial-explosion vanity (huge lattice, meaningless score) | mandatory pruning (§3); report "lattice unvalidated" if unpruned |
| **KILLCRITIC** | Fake precision / fabricated benchmarks | all thresholds/weights UNKNOWN → calibrate at build; expected-signal targets never fabricated |
| **KILLCRITIC** | Unclear action | every region + score maps to an explicit action tier (§6) |

---

## 8. Consistency check vs foundations

| This file | Traces to | Class / rule enforced |
|---|---|---|
| Fingerprint dimension axes (§1) | `brief.md` diversity list · [01c] I intro · [05] | tags = INFER (INFERENCE with confidence) |
| Our occupancy + spend weighting | [02] Delivery (spend FETCH OFFICIAL) + INFER tags | CALC over FETCH+INFER |
| Competitor occupancy (§2) | [02] Competitor row (EXTERNAL) · [01d] L1/L2/L4/L5 | EXTERNAL; active != winning |
| Competitor economics never used to rank | [02] Competitor spend/results (CANNOT-KNOW) | UNKNOWN — never a fact |
| White-Space Score (§4) | [01c] I4 (expanded, not redefined) | CALC DERIVED; competitor candidates INFERENCE |
| Our-saturation index (§4) | [01c] I2 Concentration (reused) | CALC over FETCH+INFER |
| Coverage-gap input (§5) | [01c] I5 Coverage + EXTERNAL strategy list | EXTERNAL + INFER |
| Redundancy overlap (near-dup combos) | [01c] I3 Redundancy / [05] embeddings | EXTERNAL/CALC embeddings |
| Expected-signal metrics (§5.1) | [01a] attention / [01b] conversion metrics | reused; targets UNKNOWN/calibrate |
| Learning-store dependency | `brief.md` "hypothesis→result→learning→next-test" | EXTERNAL/CALC |
| Opportunity Score = a bet | `brief.md` "never present a prediction as a fact" | MODEL ESTIMATE / INFERENCE |
| Action tiers | `brief.md` action prioritisation | DO NOW/NEXT/WATCH/DO NOT ACT/NEEDS MORE DATA |

**No hardcoded benchmarks introduced.** Every weight/threshold is marked calibrated-INTERNAL or
UNKNOWN/verify-at-build. Every competitor-derived signal is a HYPOTHESIS, never a fact; competitor
economics remain UNKNOWN. **unoccupied != opportunity** and **active != winning** are enforced
structurally, not just stated.

## 9. Open items — verify/calibrate at build

1. **Dimension axes + tag schema** finalise against [05] once authored (names/granularity of primary
   vs secondary tiers).
2. **Competitor corpus scope** from [12]: which competitors are tracked, corpus freshness, tagging
   parity with our side (a mismatch biases the map).
3. **All weights** (§4 `value_w`, §5.2 Opportunity Score) — calibrate per account; none hardcoded.
4. **Min-sample floors** — tagged-history size, lattice size, competitor-corpus size below which we
   return INSUFFICIENT DATA.
5. **Pruning heuristic → embedding-neighbourhood upgrade** (`ponytail:` ceiling in §3).
6. **Learning-store wiring** — the tried-and-failed exclusion is only real if the store exists and is
   queried.
