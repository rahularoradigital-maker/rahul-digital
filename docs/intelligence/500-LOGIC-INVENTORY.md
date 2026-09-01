# AdBrain — 500+ Logic Discovery Inventory (§12, §17, §101)

**Status: DISCOVERY ONLY.** This is the candidate surface, not the build set. Nothing here is
implemented on the basis of this document. The orchestrator (§101, §159) picks the subset that
becomes product. Do **not** treat any threshold below as a shipped benchmark.

Source of authority: `docs/intelligence/MASTER-CHARTER.md`. This file satisfies Phase-0 deliverable
#17 (§155) and feeds #18 (prioritization matrix).

---

## Method

1. **Discover, don't invent (§13).** Each candidate is grounded in real media-measurement / media-buying
   / DTC-finance practice where possible. Where practice gives only a *prior* (a starting number), it is
   recorded as a tunable prior, never a universal truth.
2. **No hard-coded universal benchmarks (§18).** Every comparison is expressed **account-relative**:
   vs the account's own trailing baseline, vs the objective/campaign cohort, vs a spend-weighted peer set,
   or as a robust z-score / percentile. Numbers that appear (e.g. "spend < 20% of parent") are **tunable
   priors** carried from the existing 1061-rule corpus, not fixed law.
3. **Every card is classified** by EVIDENCE level and FUNCTION type, and carries a STATUS.
4. **Cross-referenced to code.** Before writing, `lib/` (esp. `lib/scoring`, `lib/rules`, `lib/funnel`,
   `lib/creative`, `lib/judgment`, `lib/reconcile`, `lib/ai`) and the corpora
   (`docs/decision-rules/adbrain-decision-rules.json`, `lib/judgment/rules.json`, 1061 rules) were
   skimmed to mark what already exists.

### Source tiers (§14)
T1 official platform / first-party API · T2 vetted platform docs & large-scale studies · T3 practitioner
consensus (agencies, senior buyers) · T4 single-source blog / vendor claim · T5 anonymous / forum.
T4–T5 may seed a *hypothesis* only; never a hard rule without validation (§15).

### Evidence levels (§15)
- **A** — deterministic identity / arithmetic truth or platform-defined fact (e.g. CTR = clicks/impr;
  CPA decomposition). Cannot be "wrong" if inputs are clean.
- **B** — strong, well-replicated empirical relationship, but account-conditional (e.g. frequency rise
  precedes CTR decay).
- **C** — plausible practitioner heuristic, weak/mixed evidence; SHADOW only, never hard truth.
- **D** — speculative / inferential (2nd–3rd order); label as hypothesis, decision-support not decision.

### Function types (§16) — never mixed within a card
diagnostic · predictive · prescriptive · alerting · descriptive · scoring · filtering · ranking ·
forecasting · experimental.

### Compact Logic-Card schema (faithful subset of §17)
Full §17 fields (purpose, source, formula, assumptions, min-sample, window, confidence, test) are
implied by the columns; the one-line form keeps the inventory scannable at 500+ rows.

```
ID | FN·EV | Name — question answered | inputs → output (account-relative comparison, min-sample, window)
   | 2°-order / 3°-order consequence | what-could-make-it-wrong (FP / FN risk) | Cost·Value | STATUS
```

- **FN** = function type · **EV** = evidence level.
- **Cost·Value** = implementation cost (L/M/H) · business value (L/M/H).
- **STATUS**: `EXISTS` (engine present in `lib/`), `PARTIAL` (partially built / corpus-only / demo-only),
  `CANDIDATE` (not built).
- Min-sample / window are written as **account-relative gates** (e.g. "≥ cohort-median spend", "settled
  window") rather than fixed universal cut-offs, per §18/§92/§145.

### Prioritization note (applied later, §101)
Each row will be scored **P = (Economic-Impact × Frequency × Confidence × Actionability × Learning) ÷
Impl-Cost** → BUILD NOW / BUILD NEXT / SHADOW / RESEARCH / DEFER / REJECT. That scoring is the
orchestrator's job (§159); it is deliberately **not** done here. A `P` column is reserved at the end.

---

## 1. ACCOUNT HEALTH  (§21–22, §44)  — engine: `lib/scoring/*`, `healthFor`, `adScore`

```
L001 | scoring·B | Composite account health — is the account healthy right now? | component sub-scores (efficiency, creative, funnel, allocation, stability, risk, data-quality) → 0–100 w/ decomposition, spend-weighted, vs own 90d baseline | 2°: score hides which lever moved / 3°: chasing score not economics | collinear components double-count; unweighted small ads distort | M·H | EXISTS
L002 | diagnostic·B | Primary-reason attribution — WHY is health what it is? | ranked component deltas → single dominant driver + secondary | 2°: over-simplifies multi-cause / 3°: user fixes wrong lever | two near-tied drivers reported as one | M·H | EXISTS
L003 | descriptive·A | Top strength / top risk surfacing — what's carrying vs threatening the account? | best & worst weighted component → labelled pair | 2°: risk framed as strength if spend-weighted only / 3°: complacency | survivorship: dead ads excluded from risk | L·M | EXISTS
L004 | scoring·B | Health monotonicity guard — does score move sanely as inputs move? | perturbation of one input → sign-stable score change | 2°: non-monotone score erodes trust / 3°: user distrusts all outputs | interaction terms break monotonicity | M·M | CANDIDATE
L005 | scoring·C | Health stability / hysteresis — is today's score noise or signal? | day-over-day score variance vs own variance band → STABLE/VOLATILE flag | 2°: jittery score triggers churn of actions / 3°: alert fatigue | thin-spend days inflate variance | M·M | PARTIAL
L006 | diagnostic·B | Health vs spend-tier normalization — is a small account judged on same curve as a big one? | account spend tier → tier-relative component baselines | 2°: mis-tiered account gets wrong verdict / 3°: unfair cross-client compare | tier boundaries arbitrary | M·M | CANDIDATE
L007 | alerting·B | Health regime break — did the account just change state? | change-point on health series → REGIME-SHIFT alert w/ date | 2°: shift blamed on last change not true cause / 3°: wrong postmortem | seasonality mistaken for break | M·H | PARTIAL
L008 | scoring·D | Missing-data-aware health — is the score trustworthy given gaps? | data-quality score → confidence haircut on health | 2°: confident score on thin data / 3°: decisions on air | zero != missing conflation | M·H | PARTIAL
L009 | diagnostic·B | Health decomposition drift — which component is trending, not just today? | 30d slope per component → improving/declining tags | 2°: today healthy but declining fast / 3°: late reaction | slope on short window = noise (§145) | M·M | PARTIAL
L010 | descriptive·A | Account maturity classifier — new vs established account context. | account age, spend history depth → NEW/RAMPING/MATURE | 2°: mature thresholds on a 2-week account / 3°: false alarms | reactivated old account looks mature | L·M | CANDIDATE
L011 | scoring·C | Multi-brand roll-up health — portfolio-of-accounts health for agencies. | per-account health → spend-weighted agency roll-up | 2°: one big client masks sick small ones / 3°: agency blind spot | weighting by spend hides count risk | M·M | CANDIDATE
L012 | alerting·B | Health floor breach — account crossed a self-relative danger line. | health < account's own p10 trailing → escalation | 2°: floor drifts down slowly unnoticed / 3°: boiled-frog decline | absolute floor would break §18; must be relative | L·H | CANDIDATE
```

## 2. SPEND ALLOCATION  (§44, §23–27)  — engine: `lib/rules/waste.ts`, `trappedBudget`, `opportunityLoss`

```
L013 | diagnostic·A | Spend concentration map — where is the money actually going? | spend share by campaign/adset/ad → HHI + top-N share | 2°: concentration ok if winners / 3°: fragility if forced | active-state not weighted → dead spend counted | L·H | EXISTS
L014 | prescriptive·B | Trapped budget — money stuck in below-cohort-efficiency entities. | entity CPA vs cohort, spend share → reallocatable $ | 2°: moving budget resets learning / 3°: churn cost | attribution lag makes fresh ad look bad | M·H | EXISTS
L015 | diagnostic·B | Opportunity loss — what did under-funding winners cost? | winner marginal-efficiency × unspent headroom → $ left on table | 2°: assumes linear scaling / 3°: over-promises recoverable $ | diminishing returns ignored | M·H | EXISTS
L016 | prescriptive·B | Reallocation candidate ranking — which $1 should move first? | (source waste, dest headroom, confidence) → ranked moves | 2°: thrash if reversed next day / 3°: buyer distrust | ranking ignores learning-phase cost | M·H | PARTIAL
L017 | diagnostic·C | Allocation vs objective mismatch — is spend on the right objective for the goal? | objective mix vs stated goal → mismatch flag | 2°: prospecting starved for retargeting / 3°: funnel starvation | goal not captured in data | M·M | CANDIDATE
L018 | descriptive·A | Prospecting-vs-retargeting split — is the top of funnel being fed? | audience-type spend share → ratio vs own trailing | 2°: over-retargeting shrinks pool / 3°: CAC creep later | audience labels unreliable | L·H | CANDIDATE
L019 | alerting·B | Budget starvation — a proven winner is spend-capped. | winner at/near budget cap w/ headroom → alert | 2°: uncapping breaks pacing / 3°: CPM spike | cap vs delivery-limited confusion | L·H | PARTIAL
L020 | diagnostic·C | Spend-share vs conversion-share gap — is money aligned with results? | spend share − conversion share per entity → misalignment | 2°: penalizes upper-funnel unfairly / 3°: kills awareness | last-click attribution bias | M·M | PARTIAL
L021 | prescriptive·D | Marginal-dollar router — where does the next $ earn most? | per-entity marginal efficiency curve → next-$ target | 2°: curve unstable at low volume / 3°: over-scaling | curve fit on thin data | H·H | CANDIDATE
L022 | descriptive·A | Dormant-spend detector — spend with ~zero outcome. | entities w/ spend & near-zero conversions over settled window → waste list | 2°: kills learning ads early / 3°: no fresh winners | attribution gap ≠ zero result | L·H | EXISTS
```

## 3. CREATIVE PERFORMANCE  (§37–39)  — engine: `lib/scoring/winner.ts`, `creativeScore`, `adScore`

```
L023 | scoring·B | Creative performance score — how good is this creative vs its fair pool? | CTR/CVR/CPA/thumbstop vs cohort, spend-weighted, shrinkage → 0–100 | 2°: score without delivery context misleads / 3°: kill good ad | tiny-spend ad ranked (§92) | M·H | EXISTS
L024 | ranking·B | Fair-pool ranking — rank creatives only within comparable delivery. | same objective/placement/audience cohort → within-pool rank | 2°: cross-pool compare unfair / 3°: wrong winner | pool too small to rank | M·H | PARTIAL
L025 | diagnostic·A | Thumbstop / hook-rate — does the creative earn attention? | 3s-video-views ÷ impressions vs own library | 2°: high hook, low hold = clickbait / 3°: LP mismatch | video vs static not comparable | L·M | PARTIAL
L026 | diagnostic·A | Hold-rate / retention — does it keep attention to CTA? | thruplays / 15s-views ÷ 3s-views vs library | 2°: hold high, CVR low = wrong promise / 3°: refund risk | short vs long asset skew | L·M | CANDIDATE
L027 | diagnostic·B | Creative CVR isolation — is it the creative or the LP/offer? | ad CVR vs cohort while holding LP constant | 2°: blames creative for LP fault / 3°: wasted reshoot | shared LP confound | M·H | PARTIAL
L028 | scoring·B | Shrinkage-adjusted creative rank — 1 sale at 15x must not beat 100 at 5x (§20). | Bayesian shrink of CPA/ROAS to cohort mean | 2°: over-shrinks true breakout / 3°: slow to back winners | prior mis-set | M·H | PARTIAL
L029 | descriptive·A | Spend-weighted portfolio CTR/CVR — account creative baseline. | Σ weighted rates → rolling baseline for all relative rules | 2°: baseline dragged by one whale ad / 3°: false "healthy" | outlier ad dominates | L·H | EXISTS
L030 | diagnostic·C | First-frame / static-hook quality — image ad attention proxy. | CTR on static vs static-library median | 2°: CTR ≠ quality (bait) / 3°: brand harm | placement mix confound | M·M | CANDIDATE
L031 | ranking·B | Emerging creative spotter — high early efficiency, low spend. | early CVR/CTR z-score at low spend → watch list | 2°: false positive on luck / 3°: premature scale | regression-to-mean (§19) | M·H | EXISTS
L032 | diagnostic·B | Creative vs format-expected — is it good for its format or just format-lucky? | ad metric vs same-format cohort | 2°: credits format not idea / 3°: clone wrong thing | format taxonomy stale | M·M | PARTIAL
L033 | alerting·B | New-creative underperformance — fresh ad failing its cohort early. | early-window metric vs launch cohort → cull candidate | 2°: kills in learning phase / 3°: no volume | learning-phase noise (§145) | L·M | PARTIAL
L034 | descriptive·A | Creative-to-spend coverage — how much spend rides on how few creatives? | # creatives holding X% spend → concentration | 2°: 1-ad account = fragile / 3°: crash risk | counts paused as active | L·H | EXISTS
```

## 4. CREATIVE FATIGUE  (§28–30, §93)  — engine: `lib/rules/fatigue.ts`, `lib/scoring/fatigue.ts`, `fatigueV2`

```
L035 | diagnostic·B | Fatigue state machine — what temporal state is this creative in? | multi-metric trajectory → UNKNOWN/HEALTHY/EARLY_WARNING/DEGRADING/FATIGUED/SEVERELY/RECOVERING, evidence-gated | 2°: state ≠ single metric / 3°: one-day collapse false-call | thin day flips state (§145) | H·H | EXISTS
L036 | diagnostic·B | Frequency-driven fatigue — is rising frequency eroding response? | frequency ↑ + CTR ↓ co-movement vs own history | 2°: high freq ok for retargeting / 3°: kill valid RT | freq denominator (reach) stale | M·H | EXISTS
L037 | diagnostic·B | Fatigue cause disambiguation — fatigue vs saturation vs auction vs offer vs LP vs tracking vs mix vs budget vs season. | multi-signal panel → labelled cause | 2°: mislabel → wrong fix / 3°: reshoot when it was CPM | confounded signals | H·H | PARTIAL
L038 | predictive·B | CTR decay slope — how fast is engagement decaying? | robust regression slope of CTR vs own peak/baseline | 2°: slope on noise / 3°: premature refresh | censoring / short history | M·H | EXISTS
L039 | alerting·B | Early-warning fatigue — pre-degradation signal before CPA moves. | leading signals (freq, CTR, hook-rate) diverge → EARLY_WARNING | 2°: labelled prediction not fact (§54) / 3°: cry-wolf | leading≠lagging in this account | M·H | EXISTS
L040 | diagnostic·B | Audience saturation vs creative fatigue split — is it the ad or the pool? | reach-vs-total-addressable + freq + new-reach rate | 2°: refresh creative when pool is tapped / 3°: no lift | audience size unknown | H·H | PARTIAL
L041 | diagnostic·C | CPA-rise attribution — how much of CPA rise is fatigue vs CPM vs CVR? | CPA ≈ CPM/(CTR·LPV·CVR) decomposition (§27) | 2°: "all fatigue" mislabel / 3°: wrong lever | decomposition needs clean funnel | M·H | PARTIAL
L042 | diagnostic·B | Recovery detection — did a rested/refreshed creative come back? | post-trough metric recovery vs own peak | 2°: dead-cat bounce called recovery / 3°: re-scale a loser | short recovery window | M·M | PARTIAL
L043 | prescriptive·B | Refresh-vs-retire decision — refresh angle or kill the concept? | fatigue state + concept diversity + winner scarcity → action | 2°: retire last winner / 3°: portfolio hole | no replacement ready | M·H | PARTIAL
L044 | forecasting·C | Days-to-fatigue forecast — when will this creative fatigue? | decay slope + freq trajectory → ETA w/ interval (§98) | 2°: false precision / 3°: mistimed swap | non-stationary decay | H·M | EXISTS
L045 | diagnostic·B | Multi-metric fatigue confirmation — require ≥2 agreeing signals (§142). | CTR↓ + freq↑ + CPA↑ agreement → confirmed | 2°: single-signal false call / 3°: distrust | CTR↓ but CVR↑ conflict (§143) | M·H | PARTIAL
L046 | diagnostic·C | Placement-level fatigue — is only one placement fatiguing? | per-placement CTR trend vs blended | 2°: blended hides Reels fatigue / 3°: whole ad blamed | placement data sparse | M·M | CANDIDATE
L047 | alerting·C | Fatigue-under-scale — creative fatigues faster when scaled hard. | spend-velocity × fatigue-slope interaction → warn | 2°: scale kills winner / 3°: whiplash | correlation not cause | M·M | CANDIDATE
L048 | descriptive·A | Fatigue exposure $ — how much spend sits on fatigued creatives now? | Σ spend on FATIGUED/SEVERE states → exposure | 2°: exposure ≠ recoverable / 3°: over-promise | state lag | L·H | PARTIAL
```

## 5. CREATIVE DIVERSITY  (§33–36, §94)  — engine: `lib/rules/diversity.ts`, `lib/creative/diversity.ts`

```
L049 | scoring·B | Effective diversity — spend/impression-weighted variety, not raw count (§34). | semantic fingerprints × delivery weights → effective-diversity index | 2°: raw count looks diverse, spend on 1 / 3°: false safety | fingerprint quality | M·H | EXISTS
L050 | diagnostic·A | Concentration (HHI/entropy) — how concentrated is live spend across concepts? | spend-share by concept → HHI + entropy | 2°: concentration fine if winner / 3°: fragile if forced | concept clustering error | L·H | EXISTS
L051 | diagnostic·B | Dimension-wise diversity — variety across hook/angle/offer/format/audience/visual-mechanism. | per-dimension distinct-active count, weighted | 2°: diverse format, same angle / 3°: hidden monoculture | taxonomy coverage | M·H | PARTIAL
L052 | scoring·C | Redundancy detector — near-duplicate creatives splitting delivery. | fingerprint similarity clusters → redundant set | 2°: dupes cannibalize learning / 3°: auction self-competition | similarity threshold | M·M | EXISTS
L053 | descriptive·A | Coverage vs whitespace — which concept cells are filled? | taxonomy grid fill rate → coverage % | 2°: filled ≠ tested / 3°: false "explored" | grid definition | M·M | EXISTS
L054 | scoring·B | Strategic vs executional diversity — different ideas or same idea reskinned? | concept-level vs execution-level variety split | 2°: 10 edits of 1 idea counted as 10 ideas / 3°: brittle | classifier drift | M·H | PARTIAL
L055 | alerting·B | Diversity collapse — variety dropping as losers are culled. | effective-diversity trend ↓ → warn | 2°: healthy pruning misread as risk / 3°: keep losers | pruning vs collapse | M·M | CANDIDATE
L056 | diagnostic·C | Winner-concept over-reliance — % results from a single concept. | conversion-share by concept → dependence | 2°: concept fatigues → cliff / 3°: revenue shock | attribution to concept | M·H | PARTIAL
L057 | prescriptive·C | Diversify-now trigger — low effective diversity + high concentration + winner aging. | joint condition → produce-more signal | 2°: pushes volume over quality / 3°: budget dilution | premature diversification | M·M | CANDIDATE
L058 | descriptive·B | Diversity vs competitor set — are we narrower than rivals (§36)? | our dimension spread vs competitor ad-library spread | 2°: copies competitor mistakes / 3°: no edge | competitor data partial | M·M | EXISTS
```

## 6. CREATIVE HALF-LIFE  (§31–32, §145)  — engine: `lib/scoring/fatigue-forecast.ts` (adjacent)

```
L059 | forecasting·C | Creative half-life — time for performance to fall to half its peak. | robust decay fit vs peak, near-zero protection, censoring-aware → HL or HALF-LIFE UNKNOWN | 2°: tiny÷tiny blow-up (§145) / 3°: mistimed refresh | left/right censoring | H·M | CANDIDATE
L060 | descriptive·A | Peak detection — when did this creative actually peak? | smoothed series max w/ noise guard → peak date | 2°: noise peak / 3°: wrong HL base | single spike | M·M | CANDIDATE
L061 | diagnostic·B | Baseline vs peak framing — is "decline" just reversion to normal? | peak vs stable baseline gap | 2°: normalizes healthy ad as fatigued / 3°: over-refresh | baseline drift | M·M | CANDIDATE
L062 | filtering·A | Min-history gate — refuse HL when history too short. | days-active vs min → UNKNOWN if insufficient | 2°: false HL on 3 days / 3°: bad forecast | gate too strict misses fast decayers | L·M | CANDIDATE
L063 | forecasting·C | Cohort half-life prior — expected HL by format/angle for new creatives. | historical HL distribution by dimension → prior for cold creative | 2°: prior overrides live data / 3°: mislead | small cohort | M·M | CANDIDATE
L064 | descriptive·B | Slope-stability check — is the decay slope reliable enough to act? | slope CI width vs threshold → reliable/UNKNOWN | 2°: acts on unstable slope / 3°: churn | variance underestimated | M·M | CANDIDATE
L065 | predictive·C | Remaining-life estimate — how much useful life is left? | HL + current position → remaining productive spend window | 2°: false precision (§98) / 3°: hoard/dump timing | non-stationary | M·M | CANDIDATE
L066 | diagnostic·C | Re-acceleration flag — half-life invalidated by a genuine second wind. | post-fit upward change-point → invalidate HL | 2°: keeps stale HL / 3°: kill reviving ad | seasonal bump | M·L | CANDIDATE
```

## 7. CREATIVE TESTING  (§40–43)  — engine: `lib/creative/strategy.ts`, `whiteSpace`

```
L067 | experimental·B | Test-pool quality — was this a fair test (§39, first-class variable)? | equal delivery/budget/time across variants → fair/unfair | 2°: "loser" from unfair test / 3°: kill good idea | delivery skew by algorithm | M·H | PARTIAL
L068 | experimental·A | Minimum-learning gate — enough spend/conversions to conclude? | variant conversions vs power requirement → conclude/wait | 2°: early call / 3°: false winner | multiple comparisons (§19) | M·H | PARTIAL
L069 | diagnostic·B | Test-vs-scale phase — is this ad testing or scaling? | spend/age/status → phase tag driving which rules apply | 2°: scale-rules on a test ad / 3°: premature kill | phase mislabel | L·H | PARTIAL
L070 | experimental·C | Iteration-vs-innovation balance — testing tweaks or new concepts? | test log concept vs execution ratio → balance | 2°: local maxima / 3°: stagnation | log incomplete | M·M | CANDIDATE
L071 | experimental·B | Variant isolation — does the test change exactly one variable? | diff of variant attributes → clean/confounded | 2°: confounded test → unattributable win / 3°: wrong lesson | attribute capture | M·H | CANDIDATE
L072 | ranking·C | Learning value ranking — which test teaches the most per $? | expected-info × addressable spend → test priority | 2°: chases novelty / 3°: wasted budget | info estimate soft | M·M | CANDIDATE
L073 | descriptive·A | Test velocity — how many valid tests per period? | count of concluded fair tests / period vs own trailing | 2°: velocity over quality / 3°: noise | invalid tests counted | L·M | CANDIDATE
L074 | experimental·C | Win-rate calibration — what share of tests actually win? | historical concluded-test win rate → prior | 2°: overconfidence / 3°: budget misallocation | survivorship | M·M | CANDIDATE
L075 | prescriptive·B | Next-test recommender — what to test next given results + gaps. | whitespace × learning-value × winner scarcity → test brief | 2°: recommends untestable idea / 3°: wasted shoot | gap stale | M·H | PARTIAL
L076 | experimental·D | Sequential-testing guard — stopping a test early inflates false wins. | interim-look correction → hold/continue | 2°: peeking bias / 3°: false winners scaled | practitioners ignore it | M·M | CANDIDATE
```

## 8. CREATIVE WHITESPACE  (§41–43)  — engine: `lib/creative/strategy.ts`, `whiteSpace`, `coverageScore`

```
L077 | diagnostic·A | Angle×hook whitespace — which concept cells are unexplored? | taxonomy grid − tested cells → open cells | 2°: fills cells with weak ideas / 3°: dilution | grid completeness | M·H | EXISTS
L078 | ranking·C | Whitespace opportunity ranking — which gap is most promising? | adjacent-winner performance × gap size → ranked gaps | 2°: extrapolates winner to gap / 3°: false promise | adjacency assumption | M·H | PARTIAL
L079 | diagnostic·B | Competitor whitespace — angles rivals use that we don't. | competitor library dimensions − ours → external gaps | 2°: copies rival's failure / 3°: me-too | rival data partial | M·M | PARTIAL
L080 | diagnostic·C | Format whitespace — untested formats given account strengths. | format grid fill × format-level performance → gaps | 2°: pushes format we can't produce / 3°: cost | production capacity ignored | M·M | CANDIDATE
L081 | diagnostic·C | Offer whitespace — untested offers/price points/guarantees. | offer taxonomy fill → gaps | 2°: offer that hurts margin / 3°: economic harm | margin not modeled | M·M | CANDIDATE
L082 | diagnostic·C | Audience whitespace — untested audiences adjacent to winners. | audience taxonomy fill × winner overlap → gaps | 2°: audience overlap cannibalization / 3°: auction self-bid | overlap unknown | M·M | CANDIDATE
L083 | prescriptive·D | Expected-learning of whitespace — what would filling a cell teach? | info-gain estimate per gap → learning value | 2°: chases learning over revenue / 3°: budget drain | speculative | M·L | CANDIDATE
L084 | descriptive·A | Exploration-vs-exploitation ratio — testing new vs milking winners. | new-cell spend vs winner spend → ratio vs own trailing | 2°: over-explore starves winners / 3°: CAC spike | phase blind | L·M | CANDIDATE
```

## 9. HOOK / ANGLE / OFFER / FORMAT / AUDIENCE ANALYSIS  (§40, §118–119)  — engine: `lib/creative/decode.ts`, `strategy.ts`

```
L085 | descriptive·B | Creative decode — extract hook/angle/offer/format/visual-mechanism per ad. | AI vision+copy decode → structured tags (versioned taxonomy §118) | 2°: bad tags poison every downstream rule / 3°: systemic error | model hallucination (§68) | M·H | EXISTS
L086 | diagnostic·B | Hook performance — which hooks drive thumbstop? | hook tag × hook-rate vs library | 2°: hook credited for offer's win / 3°: clone wrong element | tag error | M·H | PARTIAL
L087 | diagnostic·B | Angle performance — which messaging angles convert? | angle tag × CVR/CPA vs cohort | 2°: angle fatigue mistaken for creative fatigue / 3°: mis-refresh | angle overlap | M·H | PARTIAL
L088 | diagnostic·B | Offer performance & margin interaction — which offers win AND protect margin? | offer tag × CPA × margin → net-value rank | 2°: winning offer kills margin (§64) / 3°: unprofitable growth | margin data missing | M·H | CANDIDATE
L089 | diagnostic·B | Format performance — which formats work for this account? | format tag × metric vs format cohort | 2°: format-luck vs idea confound / 3°: over-invest format | placement mix | M·M | PARTIAL
L090 | diagnostic·B | Audience performance — which audiences respond? | audience tag × CVR/CPA vs cohort | 2°: overlap inflates / 3°: self-competition | audience labels soft | M·M | PARTIAL
L091 | diagnostic·C | Hook×angle interaction — which combinations outperform their parts? | interaction lift vs additive expectation | 2°: spurious interaction on thin data / 3°: false combo | sparse cells | M·M | CANDIDATE
L092 | ranking·C | Winning-element library — reusable proven hooks/angles/offers. | proven-element registry ranked by net value | 2°: element decays, library stale / 3°: recycle dead idea | no freshness on elements | M·H | PARTIAL
L093 | diagnostic·C | Angle saturation — an angle over-used across the account. | angle spend-share × angle-level decay | 2°: whole account leans one angle / 3°: audience blindness | share vs saturation | M·M | CANDIDATE
L094 | descriptive·A | Offer taxonomy inventory — what offers have run at all? | distinct offers run → catalog | 2°: gaps invisible / 3°: untested pricing | offer capture | L·M | CANDIDATE
L095 | diagnostic·C | Format×placement fit — right format for the placement it's served in? | format × placement × metric | 2°: 9:16 in feed penalized / 3°: mis-kill | placement data | M·M | CANDIDATE
L096 | diagnostic·D | Message-to-LP congruence — does ad promise match landing page? | ad angle tag vs LP content embedding similarity | 2°: mismatch → high CTR low CVR / 3°: refund/return risk | LP scrape quality | M·H | CANDIDATE
L097 | diagnostic·C | Hook-rate vs hold-rate quadrant — attention quality map. | hook-rate × hold-rate → quadrant (bait/strong/weak/slow) | 2°: bait ads scaled / 3°: brand harm | video-only | M·M | CANDIDATE
L098 | descriptive·B | Creative taxonomy version drift — did the tag schema change under us? | taxonomy version vs historical tags → reproducibility flag (§119) | 2°: cross-version compare invalid / 3°: false trend | version not stored | M·M | CANDIDATE
```

## 10. FUNNEL  (§45–46)  — engine: `lib/funnel/*`, `diagnoseFunnel`, `classifyStage`, `funnelFromTotals`

```
L099 | diagnostic·A | Stage conversion rates — impr→click→LPV→ATC→IC→purchase per stage. | stage counts → per-stage CVR vs own baseline | 2°: stage missing → whole funnel wrong / 3°: mis-diagnosis | pixel gaps | M·H | EXISTS
L100 | diagnostic·B | Largest MEANINGFUL leak — biggest economically-material drop, not lowest %. | stage drop × economic exposure → primary leak (§46) | 2°: fixes a small-$ big-% leak / 3°: wasted effort | tiny-stage % noise | M·H | EXISTS
L101 | diagnostic·B | Leak-cause classifier — creative vs audience vs LP vs offer vs checkout vs tracking. | stage signature → labelled cause | 2°: blame ad for checkout fail (§46) / 3°: wrong fix | shared-stage confound | M·H | PARTIAL
L102 | diagnostic·A | Stage vs baseline change — which stage moved recently? | per-stage rate delta vs trailing | 2°: seasonal shift misread / 3°: false leak | short window (§145) | M·H | EXISTS
L103 | descriptive·A | Funnel economic exposure — $ flowing through each stage. | spend × stage position → exposure per stage | 2°: over-weights top / 3°: ignores BOF | attribution basis | M·M | EXISTS
L104 | diagnostic·C | Cross-entity funnel compare — which adset/creative funnel leaks worst? | per-entity stage rates vs cohort | 2°: thin entity funnel noisy / 3°: mis-rank | sample per entity | M·M | PARTIAL
L105 | diagnostic·B | Click-to-LPV gap — ad clicks not landing (speed/redirect/bots). | clicks vs LPV gap vs own norm | 2°: LP speed / 3°: pays for non-arrivals | click inflation | M·H | CANDIDATE
L106 | diagnostic·B | ATC→purchase leak — checkout/payment friction. | ATC vs purchase vs baseline | 2°: shipping/price shock / 3°: cart abandon | server events partial | M·H | CANDIDATE
L107 | diagnostic·C | Micro vs macro conversion split — leading funnel signals when purchases sparse. | micro-conv rates as proxy | 2°: optimizes micro not revenue / 3°: junk leads | proxy validity | M·M | CANDIDATE
L108 | alerting·B | Funnel break alert — a stage rate collapsed (tracking or real). | stage rate → 0 or cliff → alert w/ tracking-vs-real hint | 2°: tracking outage looks like funnel death / 3°: panic | zero≠missing (§79) | M·H | PARTIAL
L109 | diagnostic·D | Funnel refuses-to-answer — data untrustworthy, return HOLD. | data-quality gate on funnel → HOLD/UNKNOWN | 2°: silent bad answer avoided / 3°: trust preserved | over-conservative | M·H | EXISTS
L110 | descriptive·A | Objective-appropriate funnel — leads vs sales funnel shape. | objective → correct stage set | 2°: sales stages on lead-gen / 3°: false leak | objective mislabel | L·M | PARTIAL
```

## 11. LANDING PAGE  (§45, §27)  — engine: mostly CANDIDATE (Shopify/LP data limited)

```
L111 | diagnostic·B | LP conversion isolation — is the LP the bottleneck? | LPV→purchase CVR vs account LP baseline | 2°: blames LP for offer/price / 3°: wasted redesign | traffic-quality confound | M·H | CANDIDATE
L112 | diagnostic·C | LP speed impact — does load time cost conversions? | LP TTFB/LCP vs click-to-LPV gap | 2°: infra fix vs creative fix / 3°: mis-prioritize | no RUM data | M·M | CANDIDATE
L113 | diagnostic·C | Mobile-vs-desktop LP gap — device-specific LP failure. | device-split CVR vs blended | 2°: blended hides mobile fail / 3°: 70% traffic lost | device data | M·M | CANDIDATE
L114 | diagnostic·D | Message-match (ad→LP) — congruence of promise and page. | ad angle vs LP embedding | 2°: mismatch = high bounce / 3°: wasted clicks | scrape quality | M·M | CANDIDATE
L115 | diagnostic·C | LP variant performance — which LP wins for which creative? | LP × creative CVR matrix | 2°: LP-creative interaction ignored / 3°: wrong pairing | UTM completeness | M·M | CANDIDATE
L116 | alerting·C | LP outage / 404 / OOS — page broken while spend runs. | LPV present, purchase ~0 + status → alert | 2°: spend on dead page / 3°: full-day burn | detection lag | L·H | CANDIDATE
L117 | diagnostic·C | Bounce/scroll proxy — engagement quality on LP. | LPV vs downstream micro-events | 2°: proxy misleads / 3°: false LP blame | events partial | M·M | CANDIDATE
L118 | diagnostic·D | Price-shock at LP — CVR drop after price change. | LP price change event vs CVR | 2°: price test misread as fatigue / 3°: wrong lever | price capture | M·M | CANDIDATE
```

## 12. CONVERSION  (§45, §27)  — engine: `lib/metrics/funnel-metrics.ts`, `cpa`, `roas`

```
L119 | descriptive·A | CVR baseline — account/objective/audience conversion rate. | purchases/clicks (or LPV) spend-weighted → rolling baseline | 2°: one whale skews / 3°: false norm | attribution window | L·H | EXISTS
L120 | diagnostic·B | CVR decomposition — is CVR down from traffic quality or page/offer? | CVR split by audience×creative×LP | 2°: mislabels driver / 3°: wrong fix | sparse cells | M·H | PARTIAL
L121 | diagnostic·B | CPA decomposition — CPA ≈ CPM/(CTR·LPV·CVR) (§27). | funnel multipliers → which term moved | 2°: "fatigue" for a CPM problem / 3°: reshoot waste | funnel gaps | M·H | PARTIAL
L122 | alerting·B | CVR collapse — conversion rate cliff vs tracking failure. | CVR → 0/cliff + event health → real-vs-tracking | 2°: pixel outage = false collapse / 3°: panic kill | zero≠missing | M·H | PARTIAL
L123 | diagnostic·C | Assisted-vs-last-click CVR — view/assist contribution. | attribution-model CVR compare | 2°: last-click undercredits TOF / 3°: kill awareness | model availability | M·M | CANDIDATE
L124 | forecasting·C | CVR seasonality adjust — is CVR change seasonal? | deseasonalized CVR vs raw | 2°: seasonal dip = false fatigue / 3°: mis-time | short history | M·M | CANDIDATE
L125 | diagnostic·D | New-vs-returning CVR — conversion quality by customer type. | new/returning split CVR | 2°: returning inflate blended / 3°: over-credit prospecting | customer-type data | M·H | CANDIDATE
L126 | diagnostic·C | Time-to-convert lag — conversions arriving after window. | conversion lag distribution vs window | 2°: fresh ad undercounted / 3°: premature kill (§8) | lag data | M·H | PARTIAL
```

## 13. BUDGET SCALING  (§47–49)  — engine: `lib/rules/will-break.ts`, `scalingHeadroom`, `marginalScaling`, `replacementRequirement`

```
L127 | prescriptive·B | Scale readiness — should this entity be scaled at all (§47, not on ROAS alone)? | marginal-eff + spend level + volume + fatigue + capacity + margin → verdict | 2°: scale on ROAS alone → CPA blow / 3°: waste | thin volume | M·H | EXISTS
L128 | predictive·B | Will-break forecast — will scaling this break efficiency? | scale-elasticity + fatigue slope → break risk | 2°: false confidence / 3°: overspend | elasticity on thin data | M·H | EXISTS
L129 | diagnostic·B | Scale elasticity / diminishing returns — how does eff change with spend? | spend vs CPA curve fit → elasticity | 2°: curve unstable low-volume / 3°: over/under-scale | non-stationary | H·H | PARTIAL
L130 | prescriptive·B | Scaling headroom — how much more spend before returns fall? | current spend vs curve knee → headroom $ | 2°: linear assumption / 3°: over-promise | knee estimate soft | M·H | EXISTS
L131 | diagnostic·B | Budget-shock detector — separate scaling shock from creative decline (§49). | budget-change event vs CPA move → shock-vs-fatigue | 2°: blames creative for a budget doubling / 3°: wrong fix | change log gaps | M·H | PARTIAL
L132 | prescriptive·C | Scale-step sizing — how big a budget step is safe? | volatility + learning-reset risk → step % vs own history | 2°: too-big step resets learning / 3°: CPA spike | reset behavior unknown | M·M | CANDIDATE
L133 | prescriptive·C | Replacement requirement — need N new winners to sustain scale. | winner decay rate × scale target → required pipeline | 2°: scale without pipeline → cliff / 3°: crash | decay estimate | M·H | EXISTS
L134 | diagnostic·C | CBO vs ABO scaling behavior — structure-specific scaling rules. | structure type → applicable scaling logic | 2°: ABO rules on CBO / 3°: wrong action | structure detect | M·M | PARTIAL
L135 | alerting·B | Over-scale early warning — CPA creeping as spend climbs. | rolling CPA vs spend-velocity → warn | 2°: labelled prediction (§54) / 3°: cry-wolf | velocity noise | M·H | PARTIAL
L136 | prescriptive·D | De-scale / cool-down — when to pull spend back to recover eff. | post-break state → reduce-spend plan | 2°: kills momentum / 3°: lost volume | recovery unknown | M·M | CANDIDATE
L137 | diagnostic·C | Learning-phase-aware scaling — don't judge/scale mid-learning. | learning status → gate scale verdicts | 2°: scale/kill in learning / 3°: reset loop | status availability | L·H | PARTIAL
L138 | prescriptive·D | Vertical vs horizontal scaling — raise budget vs duplicate/broaden. | headroom + audience saturation → scale mode | 2°: vertical into saturated pool / 3°: no lift | saturation unknown | M·M | CANDIDATE
```

## 14. CAMPAIGN / AD-SET STRUCTURE  (§80)  — engine: `lib/rules/account.ts`, `objectiveFamily`, `campaignTypeSpec`

```
L139 | descriptive·A | Structure inventory — campaigns/adsets/ads tree with states. | entity tree + active/paused → map | 2°: paused counted as live / 3°: false diversity | state accuracy | L·M | EXISTS
L140 | diagnostic·C | Audience overlap / fragmentation — adsets bidding against each other. | audience definition overlap → self-competition risk | 2°: internal auction inflates CPM / 3°: waste | overlap not exposed by API | M·H | CANDIDATE
L141 | diagnostic·C | Adset budget fragmentation — too many under-funded adsets. | count of sub-min-spend adsets → fragmentation | 2°: none exit learning / 3°: no winners | min-spend relative | M·M | CANDIDATE
L142 | diagnostic·B | Duplicate-creative-across-adsets — same ad splitting delivery. | creative fingerprint across adsets → dupes | 2°: self-cannibalization / 3°: skewed test | fingerprint | M·M | PARTIAL
L143 | diagnostic·C | Structure vs objective fit — right structure for the goal? | objective × structure heuristic → fit flag | 2°: CBO for a strict-CPA lead-gen / 3°: mis-delivery | heuristic soft | M·M | CANDIDATE
L144 | descriptive·A | Consolidation opportunity — many tiny adsets that could merge. | adset count vs spend → consolidation candidate | 2°: merge kills a niche winner / 3°: lost segment | winner hidden in tiny adset | M·M | CANDIDATE
L145 | diagnostic·C | Naming-convention integrity — can we even parse the account? | name pattern coverage → parseability | 2°: unparseable → every rollup wrong / 3°: garbage in | free-text names | L·M | CANDIDATE
L146 | diagnostic·C | Placement strategy — advantage+ vs manual, right for account? | placement config × placement performance | 2°: auto-placement dumps into cheap junk / 3°: brand harm | placement data | M·M | PARTIAL
L147 | alerting·C | Orphan / empty entity — adset w/ no active ads still live. | active adset, zero active ads → alert | 2°: spend on empty shell / 3°: pacing drift | state lag | L·M | CANDIDATE
L148 | diagnostic·C | Advantage+ Shopping vs BAU split — ASC cannibalization of BAU. | ASC vs standard overlap + incrementality | 2°: ASC steals BAU credit / 3°: double-pay | incrementality missing | M·H | CANDIDATE
L149 | descriptive·A | Structure complexity score — is the account over-engineered? | entity counts vs spend → complexity vs peers | 2°: complexity slows learning / 3°: ops cost | peer set | L·M | CANDIDATE
L150 | diagnostic·C | Retargeting-pool sizing — RT audiences big enough to spend on? | RT audience size vs spend → over-spend risk | 2°: over-frequency on tiny pool / 3°: fatigue | audience size | M·M | CANDIDATE
```

## 15. OBJECTIVE  (§16, §110)  — engine: `lib/rules/objective-metrics.ts`, `objectiveFamily`, `objectiveHeadline`

```
L151 | descriptive·A | Objective classifier — what is this campaign optimizing for? | campaign objective field → family (sales/leads/traffic/awareness/engagement) | 2°: wrong family → wrong metric set / 3°: false verdict | objective renamed | L·H | EXISTS
L152 | diagnostic·B | Objective-appropriate KPI — judge by the objective's own KPI. | family → primary KPI (ROAS/CPL/CPC/CPM) | 2°: ROAS on awareness / 3°: kill valid TOF | family mislabel | L·H | EXISTS
L153 | diagnostic·C | Objective-optimization mismatch — optimizing for a proxy of the goal. | conversion event vs business goal | 2°: optimizes cheap event, not revenue / 3°: junk volume | event mapping | M·H | PARTIAL
L154 | diagnostic·C | Objective migration impact — did changing objective reset performance? | objective-change event vs post-change metrics | 2°: change blamed on creative / 3°: wrong postmortem | change log | M·M | PARTIAL
L155 | descriptive·A | Objective mix — spend distribution across objectives. | spend share by objective vs own trailing | 2°: over-index one objective / 3°: funnel gap | classification | L·M | PARTIAL
L156 | diagnostic·D | Objective vs funnel-stage alignment — full-funnel coverage present? | objective mix vs funnel stages → coverage gaps | 2°: all-BOF starves pipeline / 3°: CAC creep | goal capture | M·M | CANDIDATE
```

## 16. ATTRIBUTION  (§56–60, §97)  — engine: `lib/scoring/attribution.ts`

```
L157 | diagnostic·B | Attribution-window sensitivity — how much do results depend on the window? | 1d/7d/28d click+view compare → window-sensitivity | 2°: window shopping inflates ROAS / 3°: false winner | window not stored | M·H | EXISTS
L158 | diagnostic·B | Click-vs-view attribution split — how much is view-through? | view-through share of conversions | 2°: view-through overcredits / 3°: scale a ghost | model availability | M·H | PARTIAL
L159 | diagnostic·C | Platform-vs-server (CAPI) gap — pixel vs server event delta. | browser vs CAPI event counts → gap | 2°: under-report kills good ad / 3°: waste | CAPI setup | M·H | PARTIAL
L160 | diagnostic·C | Cross-platform double-counting — Meta + Google both claim the sale. | platform-claimed vs blended orders → overlap | 2°: sum > truth → over-scale / 3°: MER divergence | no dedupe key | M·H | CANDIDATE
L161 | diagnostic·B | Attribution lag / late conversions — conversions still arriving. | conversion lag curve → maturity of window | 2°: judging unsettled data / 3°: premature kill (§8) | lag data | M·H | PARTIAL
L162 | diagnostic·D | iOS/consent under-reporting — modeled-conversion inflation. | modeled vs observed share | 2°: modeled masks real drop / 3°: false health | platform opacity | M·M | CANDIDATE
L163 | reconciliation·C | Platform-vs-Shopify attribution gap — ad-reported vs actual orders. | Meta purchases vs Shopify orders → gap + likely reason | 2°: trust wrong number / 3°: mis-scale (§57) | order matching | M·H | CANDIDATE
L164 | descriptive·A | Attribution-basis label — every metric states its basis (§59). | metric → {model, window, click/view} tag | 2°: compare apples/oranges / 3°: silent error | basis not captured | L·H | PARTIAL
L165 | diagnostic·D | Incrementality-vs-attribution divergence — attributed ≠ incremental. | attributed ROAS vs lift-based ROAS | 2°: over-invest attributed retargeting / 3°: waste | no lift test | M·H | CANDIDATE
L166 | alerting·C | Attribution setting change — pixel/CAPI/window changed under us. | config-change event → flag + confidence haircut | 2°: trend break misread / 3°: false fatigue | change detection | M·M | CANDIDATE
```

## 17. DATA QUALITY  (§55, §79, §128–130)  — engine: `lib/data-quality.ts`, `lib/scoring/data-quality.ts`, `assessDataQuality`

```
L167 | scoring·A | Data-health score — how trustworthy is this account's data? | missing days/ads, stale sync, dupes, zero-runs, currency/tz mismatch → 0–100 | 2°: drives every downstream confidence / 3°: bad score = HOLD | metric coverage | M·H | EXISTS
L168 | alerting·A | Stale-sync detector — is the data current? | last-sync vs expected cadence → stale flag | 2°: acting on old data / 3°: wrong call | cadence unknown | L·H | EXISTS
L169 | diagnostic·A | Missing-day / gap detector — holes in the time series. | expected vs present dates → gaps | 2°: gap averaged as zero → false decline / 3°: mis-diagnose | expected calendar | L·H | EXISTS
L170 | diagnostic·A | Zero≠missing enforcement — distinguish true-zero from no-data (§79). | zero-with-spend vs no-row → classify | 2°: no-data as zero result / 3°: false waste | source semantics | M·H | EXISTS
L171 | diagnostic·B | Duplicate-row detector — double-counted metrics. | key dedupe → dupe count | 2°: inflated spend/conv / 3°: wrong CPA | key definition | M·H | PARTIAL
L172 | diagnostic·B | Currency / timezone consistency — mixed units in aggregates (§59). | per-row currency/tz vs account → mismatch | 2°: summing mixed currencies / 3°: nonsense totals | metadata missing | M·H | PARTIAL
L173 | alerting·B | Unexpected-zero run — a live entity suddenly reporting zeros. | active entity, zero delivery streak → alert | 2°: delivery halt vs tracking gap / 3°: panic | zero≠missing | M·H | PARTIAL
L174 | diagnostic·C | Spend-without-metadata — spend rows lacking creative/audience tags. | untagged-spend share → decode-coverage gap | 2°: decode rules blind to that spend / 3°: partial truth | tag pipeline | M·M | PARTIAL
L175 | diagnostic·B | Account-total reconciliation — do row sums equal account headline (§56)? | Σ rows vs account-level total → residual | 2°: headline mismatch erodes trust / 3°: which is canon? | account attribution | M·H | EXISTS
L176 | scoring·C | Completeness-weighted confidence — haircut outputs by coverage. | coverage % → confidence multiplier | 2°: confident on partial data / 3°: overreach | coverage calc | M·M | PARTIAL
L177 | diagnostic·C | Backfill / restatement detector — historical numbers changed. | prior-day value drift → restatement flag | 2°: stale cached verdicts / 3°: wrong history | snapshotting | M·M | CANDIDATE
L178 | alerting·B | Sync-failure-not-success — failed sync must not read as success (§130). | job status → visible failure, never silent | 2°: silent stale = confident wrong / 3°: trust loss | job telemetry | M·H | PARTIAL
```

## 18. META DELIVERY  (§21, T1)  — engine: `lib/meta-source.ts`, `lib/meta-sync.ts`

```
L179 | diagnostic·B | Learning-phase status — is the entity still learning? | Meta learning status / conversions-to-exit → phase | 2°: judging mid-learning / 3°: reset loop | status field availability | L·H | PARTIAL
L180 | diagnostic·B | Learning-limited detector — stuck, never exiting learning. | prolonged learning + low conv velocity → limited | 2°: structure too fragmented / 3°: no winners | field availability | M·H | CANDIDATE
L181 | descriptive·A | Delivery / impression pacing — is the budget actually spending? | spend vs budget pacing vs own norm | 2°: under-delivery misread as low demand / 3°: false kill | intraday partial | L·M | PARTIAL
L182 | diagnostic·B | Auction-competitiveness proxy — CPM rising from competition? | CPM trend vs own + delivery ranking signals | 2°: CPM up blamed on creative / 3°: wrong fix | ranking data | M·H | PARTIAL
L183 | diagnostic·C | Delivery-ranking diagnostics — quality/engagement/conversion ranking. | Meta ranking fields → below-average flags | 2°: ranking lags reality / 3°: stale action | field coverage | M·M | PARTIAL
L184 | diagnostic·C | Frequency / reach saturation — running out of new people. | new-reach rate decay vs freq rise | 2°: refresh vs broaden decision / 3°: no lift | reach denominator | M·H | PARTIAL
L185 | alerting·C | Delivery drop / disapproval — ad rejected or throttled. | active but zero-delivery + policy status → alert | 2°: silent zero spend / 3°: lost day | status latency | L·H | CANDIDATE
L186 | diagnostic·D | Auction-overlap self-competition — own adsets inflating own CPM. | overlapping-audience delivery → internal-competition estimate | 2°: pay more to beat yourself / 3°: waste | overlap data | M·M | CANDIDATE
L187 | descriptive·B | Placement-mix delivery — where impressions actually served. | impression share by placement vs intended | 2°: auto dumps into low-value placement / 3°: junk | placement breakdown | M·M | PARTIAL
L188 | diagnostic·C | CPM decomposition — CPM change from audience vs placement vs season vs competition. | CPM split by dimension | 2°: "creative fatigue" for a CPM/auction move / 3°: reshoot waste | dimension data | M·H | CANDIDATE
```

## 19. AUCTION DYNAMICS  (§18, T1/T2)  — engine: CANDIDATE (MCP `ads_insights_auction_*` external)

```
L189 | diagnostic·B | CPM trend vs own baseline — is inventory getting more expensive? | CPM robust trend vs account trailing + seasonal | 2°: normal seasonality misread / 3°: false fatigue | short window | M·H | PARTIAL
L190 | diagnostic·C | Bid-strategy fit — lowest-cost vs cost-cap vs bid-cap appropriate? | strategy × volatility × goal → fit | 2°: cost-cap starves delivery / 3°: no volume | strategy field | M·H | PARTIAL
L191 | diagnostic·C | Bid-cap vs delivery tradeoff — cap too low to win auctions. | cap vs winning-CPM estimate → under-delivery risk | 2°: cap chokes learning / 3°: stall | winning-CPM unknown | M·M | CANDIDATE
L192 | diagnostic·D | Auction pressure / seasonality (Q4, BFCM) — external CPM inflation. | category CPM index vs account CPM | 2°: blames account for market / 3°: wrong action | external index quality | M·M | CANDIDATE
L193 | diagnostic·C | Value-vs-volume bidding fit — value optimization for high-AOV variance. | AOV variance × bid mode → fit | 2°: volume bidding on high-variance AOV / 3°: low ROAS | AOV data | M·M | CANDIDATE
L194 | diagnostic·D | Auction win-rate proxy — share of addressable auctions won. | delivery vs reach potential → proxy | 2°: raise bid needlessly / 3°: overpay | potential unknown | M·M | CANDIDATE
L195 | alerting·C | CPM shock — sudden inventory cost spike. | CPM change-point → alert w/ market-vs-account hint | 2°: market spike = false internal alarm / 3°: panic | index availability | M·M | CANDIDATE
L196 | diagnostic·C | Broad-vs-narrow auction efficiency — targeting breadth vs CPM/CPA. | breadth × CPM × CPA | 2°: narrow drives up CPM / 3°: CAC creep | breadth measure | M·M | CANDIDATE
```

## 20. SEASONALITY  (§144, §18)  — engine: PARTIAL/CANDIDATE

```
L197 | forecasting·C | Day-of-week seasonality — is the weekly pattern being mistaken for trend? | deseasonalize by DOW vs raw | 2°: weekend dip = false fatigue / 3°: mis-time swaps | short history | M·H | CANDIDATE
L198 | forecasting·C | Intra-month / payday cycle — spend/CVR cyclicality. | monthly cycle decomposition | 2°: cycle trough misread / 3°: wrong kill | 1–2 cycles only | M·M | CANDIDATE
L199 | forecasting·B | Holiday / promo calendar — known demand spikes (BFCM, sales). | calendar overlay vs baseline | 2°: post-promo cliff misread as fatigue / 3°: over-react | calendar coverage | M·H | CANDIDATE
L200 | diagnostic·C | Seasonal-adjusted baselines — compare vs same-season last year. | YoY same-window baseline | 2°: no prior year = can't adjust / 3°: false trend | history depth | M·M | CANDIDATE
L201 | diagnostic·D | Category-seasonality prior — vertical-level demand curve. | industry seasonal prior (T2/T3) as prior only | 2°: prior overrides account / 3°: mislead | prior generality (§18) | M·L | CANDIDATE
L202 | alerting·C | Post-peak normalization — decline is reversion, not death. | peak-relative return-to-baseline detection | 2°: normal reversion = false alarm / 3°: kill winner | baseline drift | M·M | CANDIDATE
L203 | forecasting·D | Demand-forecast overlay — expected seasonal demand next window. | seasonal model → demand forecast w/ CI (§98) | 2°: false precision / 3°: over/under-budget | thin history | H·M | CANDIDATE
L204 | diagnostic·C | Weather / event exogenous shock — external demand driver flag. | anomaly + external event correlation → flag | 2°: spurious correlation / 3°: wrong story | event data | M·L | CANDIDATE
```

## 21. VOLATILITY  (§19, §144)  — engine: `lib/scoring/change-analysis.ts`, `changeVolatility`

```
L205 | descriptive·A | Metric volatility band — how noisy is this metric for this entity? | robust dispersion (MAD) vs own history → band | 2°: every rule needs this to avoid noise calls / 3°: false signals | thin data inflates | M·H | EXISTS
L206 | filtering·A | Signal-vs-noise gate — is a move outside the noise band? | delta vs volatility band → material/noise | 2°: acts on noise / 3°: churn | band mis-estimate | M·H | PARTIAL
L207 | diagnostic·B | Volatility regime change — did the entity get noisier? | rolling dispersion trend → regime flag | 2°: rising vol precedes instability / 3°: late reaction | window length | M·M | CANDIDATE
L208 | scoring·C | Stability score — how reliable are this entity's numbers? | inverse volatility → stability weight | 2°: unstable entity over-trusted / 3°: bad decisions | small-n | M·M | PARTIAL
L209 | diagnostic·C | Volatility from spend-velocity — noise induced by budget churn. | budget-change frequency × metric vol | 2°: self-inflicted noise / 3°: never settles | change log | M·M | CANDIDATE
L210 | filtering·A | Tiny-numerator guard — block trends built on 1 conversion (§145). | numerator & denominator floors (relative) → suppress | 2°: half-life tiny÷tiny bug / 3°: absurd output | floor too high hides real signal | L·H | PARTIAL
```

## 22. CONCENTRATION  (§35, §52)  — engine: `lib/rules/diversity.ts`, `concentrationScore`, `budgetConcentration`

```
L211 | scoring·A | Spend HHI — how concentrated is spend across entities? | spend-share² sum → HHI vs own trailing | 2°: high HHI ok if winners / 3°: fragile if forced | active weighting | L·H | EXISTS
L212 | scoring·A | Conversion HHI — how concentrated are results? | conversion-share² sum → HHI | 2°: 1 ad = all revenue → cliff risk / 3°: shock | attribution | L·H | PARTIAL
L213 | diagnostic·B | Single-creative dependence — % results from top creative. | top-1 conversion share → dependence | 2°: that creative fatigues → crash / 3°: revenue hole | attribution to creative | M·H | PARTIAL
L214 | diagnostic·B | Single-audience dependence — reliance on one audience. | top audience conversion share | 2°: audience saturates → cliff / 3°: CAC spike | audience labels | M·M | CANDIDATE
L215 | diagnostic·C | Single-product dependence — revenue concentration on one SKU. | SKU revenue share (needs Shopify) | 2°: stockout → revenue collapse / 3°: fragility | product data | M·H | CANDIDATE
L216 | diagnostic·C | Channel concentration — over-reliance on one platform. | platform spend/revenue share | 2°: platform policy change = existential / 3°: no hedge | cross-channel data | M·M | CANDIDATE
```

## 23. PORTFOLIO FRAGILITY  (§35, §52)  — engine: `lib/rules/diversity.ts` (redundancy/coverage adjacent)

```
L217 | scoring·B | Portfolio fragility score — how exposed is the account to one failure? | concentration + winner-age + diversity + pipeline → fragility | 2°: high score = one bad week from crisis / 3°: existential | composite weights | M·H | PARTIAL
L218 | diagnostic·B | Winner-age fragility — winners are old and un-replaced. | age distribution of spend-carrying winners | 2°: all winners aging together → synchronized cliff / 3°: crash | age tracking | M·H | CANDIDATE
L219 | diagnostic·C | Pipeline-depth fragility — no tested replacements ready. | count of validated bench creatives vs churn rate | 2°: winner dies, nothing to promote / 3°: scramble | test log | M·H | CANDIDATE
L220 | diagnostic·C | Correlated-failure risk — winners share a vulnerable element. | shared hook/angle/offer among winners → common-mode risk | 2°: one angle bans → all fail together / 3°: systemic | element tagging | M·M | CANDIDATE
L221 | alerting·B | Fragility escalation — fragility crossing own danger band. | fragility vs own p90 → escalate | 2°: slow drift unnoticed / 3°: boiled frog | band relative | M·H | CANDIDATE
L222 | descriptive·B | Diversification ROI — does adding variety actually reduce variance? | variance vs diversity historical relationship | 2°: diversify without benefit / 3°: wasted spend | causal claim weak | M·M | CANDIDATE
```

## 24. WINNER / LOSER / EMERGING  (§37–39, §95–96)  — engine: `lib/scoring/winner.ts`, `winnerScores`

```
L223 | scoring·B | Winner classifier — proven/emerging/high-eff-low-scale/high-scale-declining/fragile/learning/inconclusive (§37). | multi-signal → labelled winner class | 2°: over-simplifies / 3°: wrong action per class | class boundaries | M·H | EXISTS
L224 | filtering·B | Loser gate — no "loser" without fair pool + sufficient spend + valid attribution (§39, §96). | test-pool quality + spend + attribution → allow/suppress verdict | 2°: kill unlucky good ad / 3°: lose winner | pool quality hard | M·H | PARTIAL
L225 | ranking·B | Emerging-winner spotter — early breakout at low spend. | early z-score CVR/CTR + shrinkage → watch/promote | 2°: false positive luck / 3°: premature scale | regression-to-mean | M·H | EXISTS
L226 | diagnostic·B | High-scale-declining — big winner past its peak. | scale × fatigue state → managed-decline flag | 2°: milk vs retire timing / 3°: cliff | decay estimate | M·H | PARTIAL
L227 | diagnostic·B | High-eff-low-scale — winner starved of budget. | high eff + low spend + headroom → scale candidate | 2°: scale into saturation / 3°: no lift | headroom | M·H | PARTIAL
L228 | diagnostic·C | Fragile-winner — winning on thin/volatile data. | eff × sample × volatility → fragile flag | 2°: trust a lucky ad / 3°: overspend | sample calc | M·H | PARTIAL
L229 | filtering·A | Inconclusive gate — not enough data to classify at all. | sample vs min → INCONCLUSIVE not forced label | 2°: false label on thin data / 3°: bad action | min relative | L·H | EXISTS
L230 | diagnostic·B | Winner durability — how long has it stayed a winner? | consecutive-winning-window count | 2°: one-hit vs durable / 3°: mis-invest | window | M·M | PARTIAL
L231 | descriptive·A | Winner spend-coverage — how much spend the winners carry. | winner spend share → reliance | 2°: over-reliance = fragility link / 3°: crash | active weighting | L·H | EXISTS
L232 | prescriptive·C | Promote-from-bench — which tested creative graduates to scale. | bench performance + whitespace fit → promote | 2°: promote a fluke / 3°: waste | bench sample | M·H | CANDIDATE
L233 | diagnostic·C | Loser-vs-untested distinction — never brand an untested ad a loser. | delivery received vs fair minimum | 2°: kill starved ad / 3°: lose winner | delivery data | M·H | PARTIAL
L234 | diagnostic·D | Zombie detector — ad neither winning nor dying, quietly bleeding. | mid-pack CPA + steady spend + no trend → zombie | 2°: chronic small waste / 3°: cumulative drain | mid-pack ambiguity | M·M | CANDIDATE
```

## 25. MARGINAL PERFORMANCE  (§47–48)  — engine: `lib/scoring/marginal.ts`, `marginalScaling`

```
L235 | diagnostic·B | Marginal CPA/ROAS — efficiency of the LAST dollar, not the average. | incremental spend vs incremental result → marginal eff | 2°: avg ROAS hides bad margin / 3°: over-scale | curve fit thin | H·H | EXISTS
L236 | diagnostic·B | Diminishing-returns knee — where does the next dollar stop paying? | marginal curve inflection → knee spend | 2°: scale past knee / 3°: CAC blow | curve stability | H·H | PARTIAL
L237 | ranking·C | Marginal-efficiency ranking — order entities by next-$ value. | marginal eff per entity → allocation order | 2°: unstable at low volume / 3°: thrash | thin data | M·H | PARTIAL
L238 | diagnostic·C | Average-vs-marginal divergence — winner on average, loser at margin. | avg eff − marginal eff gap → over-scaled flag | 2°: keep feeding a saturated winner / 3°: waste | curve fit | M·H | CANDIDATE
L239 | forecasting·D | Marginal-return forecast — expected eff at +X% budget. | elasticity → forecast w/ CI (§98) | 2°: false precision / 3°: bad budget | non-stationary | H·M | CANDIDATE
L240 | prescriptive·C | Marginal-dollar reallocation — move $ from low to high marginal eff. | marginal gap across entities → move plan | 2°: ignores learning-reset cost / 3°: churn | reset cost | M·H | PARTIAL
```

## 26. INCREMENTALITY  (§97, T1/T2)  — engine: CANDIDATE (MCP lift/experiment external only)

```
L241 | experimental·B | Geo holdout lift — incremental effect via held-out geos. | test vs control geo outcomes → incremental lift + CI | 2°: attributed ≠ incremental / 3°: over-credit retargeting | geo design quality | H·H | CANDIDATE
L242 | experimental·B | Conversion-lift test read — platform lift study interpretation. | lift study output → incremental ROAS | 2°: platform grades own homework / 3°: bias | study setup | M·H | CANDIDATE
L243 | diagnostic·C | Retargeting incrementality — would they have bought anyway? | RT spend vs organic-baseline holdout | 2°: RT ROAS mostly harvest / 3°: waste on inevitable buyers | no holdout | M·H | CANDIDATE
L244 | diagnostic·C | Brand-vs-nonbrand search cannibalization — paying for organic clicks. | brand-search spend vs organic-CTR loss (Google) | 2°: pay for free clicks / 3°: budget waste | organic data | M·H | CANDIDATE
L245 | experimental·C | PSA / ghost-ad baseline — control-group counterfactual. | exposed vs control conversion rate | 2°: no valid control → no claim (§97) / 3°: false lift | control feasibility | H·M | CANDIDATE
L246 | diagnostic·D | Incremental-vs-blended MER reconciliation — does incrementality explain MER? | incremental revenue vs total → consistency | 2°: attribution says up, MER flat / 3°: which is real? | both estimates soft | M·H | CANDIDATE
L247 | experimental·D | Scale-back natural experiment — infer incrementality from spend cuts. | pre/post spend-cut revenue delta w/ controls | 2°: confounded by season / 3°: wrong lesson | control quality | M·M | CANDIDATE
L248 | filtering·A | No-causality-without-design gate — refuse causal claims without a design (§97). | design present? → allow/deny causal language | 2°: correlation dressed as cause / 3°: bad strategy | design detection | L·H | CANDIDATE
```

## 27. CAC / nCAC / MER / ROAS / CONTRIBUTION / LTV / PAYBACK  (§61–67, §91)  — engine: PARTIAL (`connectors/revenue.ts`, `roas`, `cpa`)

```
L249 | descriptive·A | Blended ROAS — total revenue ÷ total ad spend. | revenue, spend → blended ROAS vs own trailing | 2°: blended hides per-channel truth / 3°: mis-allocate | revenue source | L·H | PARTIAL
L250 | descriptive·A | Platform ROAS — per-platform attributed return. | attributed revenue ÷ platform spend | 2°: sum of platform ROAS ≠ blended / 3°: double-count | attribution overlap | L·H | EXISTS
L251 | descriptive·A | MER — marketing efficiency ratio (total rev ÷ total marketing) (§63). | total revenue ÷ total marketing spend, denominator defined | 2°: denominator ambiguity / 3°: false trend | what counts as marketing | L·H | PARTIAL
L252 | descriptive·A | CAC — blended cost to acquire a customer. | spend ÷ new customers, "customer" defined | 2°: order≠customer / 3°: overstated CAC | new-customer flag | M·H | CANDIDATE
L253 | descriptive·B | nCAC — new-customer acquisition cost (§62). | spend ÷ NEW customers, window+definition set | 2°: retargeting inflates via existing buyers / 3°: false efficiency | new vs returning tag | M·H | CANDIDATE
L254 | descriptive·B | Contribution margin ROAS — ROAS net of variable costs (§64). | (rev − COGS − fees − ship − refunds) ÷ spend | 2°: standard ROAS looks fine, contribution negative / 3°: unprofitable scale | cost inputs missing | M·H | CANDIDATE
L255 | descriptive·B | Contribution per order / per dollar — real profit unit economics. | net contribution ÷ orders | 2°: growth at negative contribution / 3°: cash burn | cost data | M·H | CANDIDATE
L256 | forecasting·C | LTV estimate — customer lifetime value by cohort. | cohort repeat-purchase curve → LTV w/ CI | 2°: LTV assumed, not earned / 3°: overpay CAC | repeat data (Shopify) | H·H | CANDIDATE
L257 | descriptive·B | LTV:CAC ratio — is acquisition economically sound? | LTV ÷ nCAC vs own trailing | 2°: healthy ROAS, broken LTV:CAC / 3°: slow death | both estimates soft | M·H | CANDIDATE
L258 | descriptive·B | Payback period — time to recover CAC. | CAC ÷ per-period contribution → months | 2°: long payback = cash-flow risk / 3°: insolvency | contribution timing | M·H | CANDIDATE
L259 | diagnostic·B | First-order vs blended profitability — is the first purchase profitable alone? | contribution on first order vs CAC | 2°: relies on repeat that may not come / 3°: fragile | repeat assumption | M·H | CANDIDATE
L260 | diagnostic·C | AOV trend & mix — is average order value moving? | AOV vs own trailing, by product mix | 2°: AOV drop erodes ROAS silently / 3°: margin squeeze | order data | M·M | CANDIDATE
L261 | diagnostic·C | Discount-adjusted revenue — revenue net of promos (§59). | gross rev − discounts → net rev basis | 2°: promo revenue inflates ROAS / 3°: false health | discount capture | M·H | CANDIDATE
L262 | alerting·B | Contribution-negative spend — spend that loses money after costs. | entities w/ negative contribution → alert | 2°: "good ROAS" but margin-negative / 3°: bleed | cost inputs | M·H | CANDIDATE
L263 | diagnostic·D | MER-vs-attribution divergence — blended flat while platforms claim growth. | ΔMER vs Σ platform-attributed Δ | 2°: attribution inflation exposed / 3°: correct the story | both soft | M·H | PARTIAL
L264 | filtering·A | No-recommendation-without-economics gate (§91). | economic context present? → allow/deny recommendation | 2°: advice without profit context / 3°: harmful scale | cost availability | L·H | CANDIDATE
```

## 28. PRODUCT & OFFER ECONOMICS  (§64–66)  — engine: CANDIDATE (Shopify)

```
L265 | diagnostic·B | Per-product profitability — which SKUs actually make money on ads? | SKU revenue − COGS − allocated spend → net | 2°: winner SKU low margin / 3°: unprofitable growth | cost + attribution | M·H | CANDIDATE
L266 | diagnostic·C | Product-market-ad fit — which products respond to paid? | SKU paid vs organic conversion lift | 2°: push wrong product / 3°: waste | product-level attribution | M·H | CANDIDATE
L267 | diagnostic·C | Offer economics — discount depth vs margin vs volume lift. | discount × volume × margin → net effect | 2°: discount buys unprofitable volume / 3°: margin erosion | margin data | M·H | CANDIDATE
L268 | diagnostic·C | Bundle / AOV-lift offers — do bundles raise contribution? | bundle AOV × margin vs single | 2°: bundle lowers per-unit margin / 3°: false win | product data | M·M | CANDIDATE
L269 | diagnostic·D | Loss-leader detection — cheap front-end funding profitable back-end. | first-product margin vs downstream LTV | 2°: kill a loss-leader that funds LTV / 3°: lose funnel | LTV linkage | M·H | CANDIDATE
L270 | diagnostic·C | Price-elasticity proxy — does price change move volume/CVR? | price change events vs CVR/volume | 2°: elasticity confounded / 3°: mis-price | price history | M·M | CANDIDATE
L271 | diagnostic·C | Margin-weighted product mix — is ad spend chasing low-margin SKUs? | spend-share vs margin-share by SKU | 2°: revenue up, profit down / 3°: cash burn | margin data | M·H | CANDIDATE
L272 | diagnostic·D | New-product ramp — expected ramp vs premature-kill for new SKUs. | new-SKU age vs performance curve | 2°: kill before ramp / 3°: lose a hit | ramp prior | M·M | CANDIDATE
```

## 29. INVENTORY  (§65–66)  — engine: CANDIDATE (Shopify)

```
L273 | alerting·B | Stockout risk under scale — will scaling this ad sell out the SKU (§65)? | SKU stock vs sell-through vs spend plan → risk | 2°: scale then stock out → wasted spend/ads for OOS / 3°: refunds | stock feed | M·H | CANDIDATE
L274 | alerting·A | Advertising an out-of-stock product — spend on unbuyable SKU. | ad→SKU link × stock=0 → alert | 2°: pay for clicks that can't convert / 3°: burn | SKU mapping | M·H | CANDIDATE
L275 | diagnostic·C | Sell-through velocity — days of cover at current spend. | stock ÷ daily sell-through → days-of-cover | 2°: scale beyond supply / 3°: backorder churn | stock accuracy | M·M | CANDIDATE
L276 | prescriptive·C | Spend-to-inventory pacing — cap spend to available stock. | stock × margin → recommended spend ceiling | 2°: over-spend into shortage / 3°: refunds+angry customers | stock feed | M·H | CANDIDATE
L277 | diagnostic·D | Size/variant stockout — top variant OOS while ad runs generic. | variant-level stock vs ad | 2°: hero size gone, CVR tanks / 3°: false fatigue | variant data | M·M | CANDIDATE
L278 | alerting·C | Restock opportunity — proven winner's SKU back in stock. | restock event × prior winner → re-activate signal | 2°: miss the re-launch window / 3°: lost revenue | restock event | M·M | CANDIDATE
```

## 30. REFUNDS  (§61, §66)  — engine: CANDIDATE (Shopify)

```
L279 | diagnostic·B | Refund-adjusted ROAS — return net of refunds/returns. | gross rev − refunds ÷ spend | 2°: gross ROAS hides return problem / 3°: false profit | refund feed | M·H | CANDIDATE
L280 | diagnostic·C | Creative-driven refund rate — does an ad over-promise (high returns)? | refund rate by creative/angle vs baseline | 2°: scale a high-return creative / 3°: margin+brand harm | refund→creative link | M·H | CANDIDATE
L281 | diagnostic·C | Product refund concentration — which SKUs drive returns? | refund rate by SKU | 2°: push a returny product / 3°: net loss | refund data | M·M | CANDIDATE
L282 | alerting·C | Refund spike — sudden return-rate jump. | refund rate change-point → alert | 2°: quality/fulfillment issue vs creative / 3°: wrong blame | refund lag | M·M | CANDIDATE
L283 | diagnostic·D | Refund lag adjustment — returns arrive after the sale window. | refund lag curve vs measurement window | 2°: fresh cohort looks profitable pre-returns / 3°: over-scale | lag data | M·H | CANDIDATE
L284 | diagnostic·D | Discount+refund interaction — promo buyers return more? | refund rate by discount depth | 2°: deep-discount cohort unprofitable / 3°: false win | joint data | M·M | CANDIDATE
```

## 31. CREATIVE PRODUCTION  (§43)  — engine: `lib/creative-production/*`, `productionPriorities`

```
L285 | prescriptive·B | Next-creative brief — concept/angle/hook/format/why-now/gap/expected-learning (§43). | performance + whitespace + winner-elements → structured brief | 2°: brief ignores production cost / 3°: unbuildable | element freshness | M·H | EXISTS
L286 | ranking·B | Production priority — which brief to make first per expected value. | expected upside × confidence ÷ production cost → rank | 2°: chases novelty over value / 3°: wasted shoots | upside estimate | M·H | EXISTS
L287 | diagnostic·C | Production-capacity vs need — enough new creatives for the churn? | churn rate vs production throughput → gap | 2°: pipeline can't feed scale / 3°: cliff | throughput data | M·M | CANDIDATE
L288 | prescriptive·C | Winning-element reuse — bake proven hooks/offers into new briefs. | element registry → brief seeding | 2°: recycle decayed element / 3°: stale ads | element freshness | M·H | PARTIAL
L289 | prescriptive·D | Iterate-vs-net-new mix — how much to iterate winners vs explore. | exploration ratio × winner age → mix guidance | 2°: over-iterate → local maxima / 3°: stagnation | ratio calc | M·M | CANDIDATE
L290 | diagnostic·C | Format-production feasibility — can this account produce the recommended format? | format history → feasibility flag | 2°: brief for UGC with no creators / 3°: undeliverable | capability capture | L·M | CANDIDATE
L291 | descriptive·B | Closed-loop attribution — did produced creative achieve expected learning (§43)? | brief hypothesis vs realized outcome → learning record | 2°: no loop = no improvement / 3°: repeat mistakes | outcome linkage | M·H | CANDIDATE
L292 | prescriptive·C | Refresh-cadence recommendation — how often to feed new creative. | half-life + churn → cadence vs own history | 2°: over-produce wastes / under starves / 3°: mistimed | HL estimate | M·M | CANDIDATE
```

## 32. COMPETITOR INTEL  (§36, COMPETITOR-INTELLIGENCE-ARCHITECTURE.md)  — engine: `lib/competitors/*`

```
L293 | descriptive·B | Competitor active-ad inventory — what are rivals running now? | ad-library pull → competitor ad set | 2°: copy without context / 3°: me-too | library coverage | M·M | EXISTS
L294 | diagnostic·B | Competitor creative-diversity vs ours — are they broader (§36)? | competitor dimension spread vs ours | 2°: mimic their spread / 3°: dilution | dedupe quality | M·M | EXISTS
L295 | diagnostic·C | Competitor longevity signal — which rival ads run longest (proxy for winners)? | ad active-duration → likely-winner proxy | 2°: longevity ≠ performance / 3°: copy a vanity ad | duration only | M·M | PARTIAL
L296 | diagnostic·C | Competitor angle/offer landscape — messaging & offers in market. | decoded competitor angles/offers → landscape | 2°: chase their offer, hurt margin / 3°: race to bottom | decode quality | M·H | PARTIAL
L297 | diagnostic·D | Share-of-voice proxy — relative ad presence in category. | competitor ad counts vs ours → SOV proxy | 2°: count ≠ spend / 3°: false dominance | no spend data | M·M | CANDIDATE
L298 | alerting·C | New-competitor-entrant / new-angle — market shift detection. | new advertiser or new angle burst → alert | 2°: react to noise / 3°: chase fads | library latency | M·M | CANDIDATE
L299 | diagnostic·C | Competitor whitespace — angles they own that we don't. | their dimensions − ours → external gaps | 2°: copy their failure / 3°: waste | performance blind | M·M | PARTIAL
L300 | diagnostic·D | Competitor fatigue proxy — rival ad refresh cadence change. | competitor creative turnover rate | 2°: infer weakness wrongly / 3°: bad timing | scrape cadence | M·L | CANDIDATE
L301 | diagnostic·D | Category-CPM pressure from competition — external cost driver. | competitor activity vs our CPM | 2°: blame creative for market CPM / 3°: reshoot waste | causality weak | M·M | CANDIDATE
L302 | filtering·A | Name-free competitor synthesis — never store sibling-tool names (project rule). | source scrub → name-free features only | 2°: leak forbidden names / 3°: policy breach | scrub coverage | L·M | PARTIAL
```

## 33. EXPERIMENT DESIGN  (§76–78, §97)  — engine: PARTIAL (`lib/rules/trust-gates.ts`)

```
L303 | experimental·A | Power / min-sample calculator — how much data to conclude? | baseline rate + MDE → required conversions | 2°: underpowered test → false read / 3°: wrong scale | baseline estimate | M·H | CANDIDATE
L304 | experimental·B | A/B significance test — is the difference real? | variant rates + n → significance + CI | 2°: peeking inflates false-positive (§76) / 3°: scale a fluke | multiple comparisons | M·H | PARTIAL
L305 | experimental·B | Fair-split verification — did variants get equal opportunity? | delivery/budget/time parity check | 2°: algorithm skews split → invalid / 3°: wrong winner | delivery data | M·H | PARTIAL
L306 | experimental·C | MDE-vs-budget feasibility — can this account even detect the effect? | traffic × baseline → detectable effect size | 2°: test that can never conclude / 3°: wasted spend | traffic estimate | M·M | CANDIDATE
L307 | experimental·C | Holdout design validity — is the control clean (§97)? | control contamination check → valid/invalid | 2°: contaminated control → false lift / 3°: bad strategy | design capture | M·H | CANDIDATE
L308 | experimental·D | Multi-armed-bandit vs A/B choice — explore/exploit tradeoff. | goal + volume → recommended design | 2°: bandit hides learning / 3°: premature convergence | design complexity | M·M | CANDIDATE
L309 | experimental·C | Test-duration recommendation — run long enough for cycles+lag. | cycle length + conversion lag → min duration | 2°: too short → seasonal bias / 3°: false read | lag data | M·M | CANDIDATE
L310 | experimental·D | Novelty-effect guard — early lift decays after novelty. | early vs settled effect gap → discount | 2°: scale a novelty spike / 3°: reversion | window | M·M | CANDIDATE
```

## 34. MEDIA BUYER PERFORMANCE  (§51)  — engine: `lib/scoring/change-*`, `rankBuyers`

```
L311 | ranking·B | Buyer ranking by change-impact — rank on measured impact, not account ROAS (§51). | attributed change outcomes per buyer → rank | 2°: reward a buyer riding a good account / 3°: unfair | attribution to actor | M·H | EXISTS
L312 | diagnostic·B | Change-quality score — do a buyer's changes help or hurt? | before/after/settled per change → net effect | 2°: credit luck / 3°: wrong incentives | control quality | M·H | PARTIAL
L313 | descriptive·A | Change volume / velocity — how much is this buyer changing? | change count per period vs norm | 2°: over-tinkering resets learning / 3°: never settles | change log | L·M | EXISTS
L314 | diagnostic·C | Over-intervention detector — churn that never lets ads settle. | change frequency vs settle-time need | 2°: self-inflicted volatility / 3°: no winners | settle-time est | M·M | PARTIAL
L315 | diagnostic·C | Decision hit-rate — share of a buyer's calls that proved right. | decision→outcome ledger → hit-rate | 2°: survivorship in ledger / 3°: false skill | outcome linkage | M·H | CANDIDATE
L316 | descriptive·B | Response-time to alerts — how fast issues get actioned. | alert→action latency per buyer | 2°: speed over correctness / 3°: rushed bad calls | action capture | M·M | CANDIDATE
L317 | diagnostic·D | Buyer specialization fit — buyer strong on scaling vs testing vs killing. | outcome by action-type per buyer | 2°: mis-assign work / 3°: value loss | small-n per type | M·M | CANDIDATE
L318 | ranking·C | Account-difficulty adjustment — grade buyers on a curve for account hardness. | account volatility/maturity → difficulty-adjusted score | 2°: penalize hard-account buyer / 3°: attrition | difficulty model | M·M | CANDIDATE
```

## 35. CHANGE IMPACT  (§50)  — engine: `lib/scoring/change-*`, `measureChangeImpact`, `diagnoseCulprit`, `lib/causality.ts`

```
L319 | diagnostic·B | Change-impact measurement — before/after/settled with controls (§50). | change event + windows + control entities → net impact | 2°: confounded by season/market / 3°: false cause | control selection | M·H | EXISTS
L320 | diagnostic·B | Culprit diagnosis — which change caused the account move? | ranked change candidates vs outcome timing → culprit | 2°: correlation-as-cause / 3°: wrong fix | change log completeness | M·H | EXISTS
L321 | filtering·A | Sufficiency gate on change reads — enough post-change data to judge. | post-window conversions vs min → judge/wait | 2°: judging unsettled change / 3°: premature | min relative | M·H | EXISTS
L322 | descriptive·A | Change log ingestion — capture every meaningful change. | activity log → normalized change events | 2°: missing changes → blind postmortem / 3°: wrong story | actor=name not email (Meta) | M·H | EXISTS
L323 | diagnostic·C | Change-vs-external disambiguation — internal change vs market shift. | change timing vs market index | 2°: blame a change for a CPM wave / 3°: wrong lesson | index availability | M·H | PARTIAL
L324 | diagnostic·B | Objective-specific change read — grade change by the objective's KPI (§50). | change × objective KPI → impact | 2°: judge awareness change on ROAS / 3°: false negative | objective map | M·M | PARTIAL
L325 | diagnostic·C | Compounding-change detangling — several changes at once. | overlapping changes → attribution caveat/HOLD | 2°: assign all effect to one / 3°: wrong credit | overlap frequency | M·H | PARTIAL
L326 | alerting·B | Risky-change pre-flight — flag a change likely to reset learning/hurt. | proposed change type × entity state → risk warning | 2°: prescriptive not deterministic / 3°: block good moves | prediction soft | M·M | CANDIDATE
L327 | descriptive·B | Change→outcome ledger — institutional memory of what worked (§112). | change + outcome + context → learning store | 2°: no memory = repeat mistakes / 3°: no moat | outcome linkage | M·H | PARTIAL
L328 | diagnostic·D | Reversibility assessment — can this change be safely undone? | change type → reversibility + reset-cost | 2°: irreversible change treated lightly / 3°: lost learning | type taxonomy | M·M | CANDIDATE
```

## 36. ACCOUNT RISK  (§52–54)  — engine: `lib/rules/will-break.ts`, PARTIAL

```
L329 | scoring·B | Composite account-risk score — how exposed is this account (§52)? | concentration + dependence + tracking + freshness + margin + inventory + platform → risk | 2°: single number hides which risk / 3°: complacency | component weights | M·H | PARTIAL
L330 | diagnostic·B | Single-point-of-failure map — the one thing that would break the account. | max-exposure dimension → SPOF | 2°: SPOF fatigues → crisis / 3°: existential | dimension coverage | M·H | CANDIDATE
L331 | diagnostic·C | Tracking-risk — reliance on fragile measurement. | modeled-conv share + CAPI health → tracking risk | 2°: measurement breaks → flying blind / 3°: bad calls | signal availability | M·M | PARTIAL
L332 | diagnostic·C | Margin-risk — thin contribution leaves no error room. | contribution margin vs volatility | 2°: one bad week → loss / 3°: insolvency | cost data | M·H | CANDIDATE
L333 | diagnostic·C | Platform-dependence risk — over-reliance on one channel/policy. | platform revenue share × policy volatility | 2°: ban/algo change = existential / 3°: no hedge | cross-channel | M·M | CANDIDATE
L334 | alerting·B | Risk escalation — a risk dimension crossed its danger band. | dimension vs own p90 → escalate | 2°: slow drift missed / 3°: boiled frog | bands relative | M·H | CANDIDATE
L335 | diagnostic·D | Cash-flow / payback risk — long payback + scaling = liquidity risk. | payback period × growth rate → cash risk | 2°: grow into insolvency / 3°: shutdown | contribution data | M·H | CANDIDATE
L336 | descriptive·B | Freshness risk — decisions running on stale data. | data staleness → decision-risk flag | 2°: confident on old data / 3°: wrong action | sync telemetry | M·M | PARTIAL
```

## 37. ALERTING  (§99)  — engine: `lib/alerts.ts`, `lib/notifications/*`

```
L337 | alerting·A | Actionability gate — no alert without a clear next action (§99). | alert candidate + suggested action → emit/suppress | 2°: alert w/o action = noise / 3°: alert fatigue | action mapping | L·H | PARTIAL
L338 | ranking·B | Alert prioritization — rank by economic impact × confidence × actionability. | candidate alerts → ranked queue | 2°: bury the $10k alert under noise / 3°: missed crisis | impact estimate | M·H | PARTIAL
L339 | filtering·B | Alert de-duplication / suppression — same issue not fired repeatedly. | alert fingerprint + cool-down → dedupe | 2°: spam erodes trust / 3°: ignored alerts | fingerprint | M·H | PARTIAL
L340 | filtering·A | Confidence-gated alerting — suppress low-confidence noise. | alert confidence vs threshold → hold/emit | 2°: cry-wolf / 3°: real alerts ignored | confidence calc | M·H | PARTIAL
L341 | alerting·B | Economic-materiality gate — only alert on money-material moves. | $ exposure vs account-relative floor → emit | 2°: alert on trivial $ / 3°: fatigue | floor relative | M·H | CANDIDATE
L342 | alerting·C | Alert-resolution tracking — did the alert get acted on & resolve? | alert→action→outcome → resolution state | 2°: unresolved alerts pile up / 3°: blind spots | outcome linkage | M·M | CANDIDATE
L343 | descriptive·B | Alert digest / grouping — batch related alerts into one story. | cluster alerts by root cause → digest | 2°: 20 alerts for 1 cause / 3°: overwhelm | clustering | M·M | CANDIDATE
L344 | alerting·D | Alert calibration — measured false-alarm rate feeds thresholds (§114). | historical FP/FN → threshold tuning | 2°: mis-tuned = fatigue or misses / 3°: distrust | outcome labels | M·M | CANDIDATE
```

## 38. AI QUALITY / COST / CONTEXT / HALLUCINATION  (§68–72, §100, §107)  — engine: `lib/ai/*`, `lib/judgment/*`, `lib/observability.ts`

```
L345 | descriptive·A | AI cost/token accounting — calls/tokens/retries/cost per feature (§70). | provider usage → cost ledger | 2°: runaway cost unseen / 3°: margin loss | provider metering | L·H | EXISTS
L346 | filtering·A | No-AI-without-reason gate — deterministic path must be exhausted first (§100). | task → can rules/SQL/cache serve it? → allow/deny AI call | 2°: AI for arithmetic / 3°: cost+risk | task classification | M·H | PARTIAL
L347 | scoring·B | AI-output grounding check — is the AI answer supported by the evidence packet (§69)? | claim vs source data → grounded/ungrounded | 2°: ungrounded claim shipped / 3°: wrong decision | packet completeness | M·H | PARTIAL
L348 | diagnostic·B | Hallucination detector — AI asserting facts not in inputs. | AI claims vs provided data → unsupported-claim flag | 2°: fabricated number trusted / 3°: bad call (§68) | claim extraction | M·H | CANDIDATE
L349 | scoring·B | Adversarial critic pass — critic tries to disprove the engine (§69). | engine packet → AI critique → agreement/conflict | 2°: AI disagreement ≠ engine wrong / 3°: overrule good calc | critic quality | M·H | EXISTS
L350 | descriptive·B | Context-budget management — hierarchical context, not whole DB (§71). | task → minimal context slice | 2°: over-stuff → cost+dilution / 3°: worse answers | slicing logic | M·H | EXISTS
L351 | filtering·A | Fingerprint-once / cache reuse — don't re-decode identical creative (§70). | creative fingerprint → cache hit | 2°: re-pay for same decode / 3°: cost | fingerprint stability | M·H | EXISTS
L352 | scoring·C | AI confidence calibration — does stated confidence match hit-rate (§114)? | AI confidence vs realized correctness | 2°: overconfident AI / 3°: misplaced trust | outcome labels | M·H | CANDIDATE
L353 | diagnostic·B | AI-memory-vs-source conflict — memory must not override live data (§72). | AI recollection vs current source → conflict flag | 2°: stale memory drives call / 3°: wrong action | memory store | M·H | PARTIAL
L354 | descriptive·B | Model/prompt versioning — reproducible AI outputs (§131–132). | prompt/model version stamp on every output | 2°: can't reproduce / 3°: undebuggable | version capture | M·M | PARTIAL
L355 | alerting·B | AI failure ≠ fake answer — surface AI failure, never fabricate (§128). | AI error → visible UNKNOWN, not filler | 2°: silent hallucinated fallback / 3°: trust loss | error handling | M·H | PARTIAL
L356 | ranking·C | Model-routing by cost/quality — cheap model for easy tasks (§70). | task difficulty → model tier | 2°: expensive model for trivial task / 3°: cost | difficulty estimate | M·M | EXISTS
```

## 39. CROSS-CHANNEL  (§60, Phase 6)  — engine: PARTIAL (`lib/google/*`)

```
L357 | descriptive·B | Unified cross-channel spend/revenue — one view across Meta+Google(+more). | per-channel normalized metrics → blended view | 2°: channels defined differently / 3°: apples/oranges | schema harmonization | M·H | PARTIAL
L358 | diagnostic·C | Cross-channel attribution overlap — both channels claim the same sale. | channel-claimed vs blended orders → overlap | 2°: double-count → over-scale / 3°: MER divergence | dedupe key | M·H | CANDIDATE
L359 | prescriptive·D | Cross-channel budget allocation — where should the next $ go across channels? | per-channel marginal eff → allocation | 2°: ignores incrementality differences / 3°: waste | marginal per channel | H·H | CANDIDATE
L360 | diagnostic·C | Channel-role classification — prospecting vs harvesting per channel. | channel funnel position → role | 2°: cut a harvesting channel that closes / 3°: revenue drop | role inference | M·M | CANDIDATE
L361 | diagnostic·D | Halo / cross-channel assist — Meta driving branded search on Google. | Meta spend vs Google brand-search volume | 2°: undercredit Meta / 3°: cut the demand driver | cross-source timing | M·H | CANDIDATE
L362 | reconciliation·C | Channel-metric semantic alignment — same metric names, different meaning (§58). | per-channel metric definitions → alignment map | 2°: compare mismatched defs / 3°: false conclusion | metadata | M·M | CANDIDATE
L363 | descriptive·B | Blended MER by channel-mix — total efficiency across the mix. | total revenue ÷ total cross-channel spend | 2°: mix shift changes MER / 3°: false trend | denominator def | M·H | PARTIAL
L364 | alerting·C | Channel-shift alert — spend/revenue mix moved materially. | mix delta vs own trailing → alert | 2°: over-react to normal shift / 3°: churn | mix calc | M·M | CANDIDATE
```

## 40. GOOGLE ADS  (Phase 6, google-ads-architecture.md)  — engine: `lib/google/*` (demo/PARTIAL)

```
L365 | descriptive·A | Google account cockpit — spend/conv/CPA/ROAS by campaign type. | Google API → normalized cockpit | 2°: Search vs PMax not comparable / 3°: mis-judge | API access | M·H | PARTIAL
L366 | diagnostic·B | Search-term / query mining — wasteful vs converting queries. | search-term report → waste + winners | 2°: broad match bleeds / 3°: CAC creep | term data | M·H | CANDIDATE
L367 | diagnostic·C | PMax black-box diagnostics — asset-group & channel breakdown where exposed. | PMax insights → channel/asset performance | 2°: PMax cannibalizes brand/shopping / 3°: over-credit | limited visibility | M·H | CANDIDATE
L368 | diagnostic·B | Brand-vs-nonbrand split — paying for brand demand vs generating it. | brand vs nonbrand CPA/volume | 2°: brand ROAS is mostly harvest / 3°: waste | keyword classification | M·H | CANDIDATE
L369 | diagnostic·C | Quality-Score / Ad-Rank diagnostics — CPC driven by relevance. | QS components → CPC-driver flags | 2°: raise bid vs fix relevance / 3°: overpay | QS availability | M·M | CANDIDATE
L370 | diagnostic·C | Impression-share lost (budget vs rank) — where is Google demand leaking? | lost-IS budget vs rank → constraint | 2°: raise budget when it's rank / 3°: no lift | IS metrics | M·H | CANDIDATE
L371 | diagnostic·C | Shopping feed health — disapprovals/missing attributes throttling. | feed diagnostics → health | 2°: feed errors silently cap delivery / 3°: lost sales | feed access | M·M | CANDIDATE
L372 | diagnostic·B | Match-type efficiency — broad/phrase/exact performance. | match-type CPA/volume | 2°: broad bleeds into junk queries / 3°: waste | term data | M·M | CANDIDATE
L373 | diagnostic·C | Device/geo/time Google segmentation — bid-adjustment opportunities. | segment CPA vs blended | 2°: uniform bids waste on bad segments / 3°: CAC creep | segment data | M·M | CANDIDATE
L374 | reconciliation·C | Google-vs-GA4-vs-Shopify order gap — which revenue is canonical (§56)? | Google conv vs GA4 vs Shopify → gap | 2°: trust wrong source / 3°: mis-scale | source access | M·H | CANDIDATE
```

## 41. SHOPIFY  (Phase 6, §61–66)  — engine: CANDIDATE (`connectors/revenue.ts` stub)

```
L375 | descriptive·A | Shopify order truth — orders/revenue/AOV as source of record. | Shopify API → canonical revenue | 2°: platform-attributed ≠ Shopify actual / 3°: over-scale | connector | M·H | CANDIDATE
L376 | descriptive·B | New-vs-returning customer split — for nCAC/LTV (§62). | customer tag on orders → split | 2°: retargeting inflates blended / 3°: false efficiency | customer flag | M·H | CANDIDATE
L377 | descriptive·B | COGS / margin ingestion — for contribution economics (§64). | product cost data → margin per order | 2°: no margin = no contribution truth / 3°: unprofitable scale | cost data entry | M·H | CANDIDATE
L378 | forecasting·C | Cohort repeat-purchase curve — LTV foundation. | order history by acquisition cohort → repeat curve | 2°: assume repeat that won't come / 3°: overpay CAC | history depth | H·H | CANDIDATE
L379 | diagnostic·C | Discount-code attribution — which promos drove which orders. | discount codes on orders → promo performance | 2°: promo revenue miscredited to ads / 3°: false ROAS | code hygiene | M·M | CANDIDATE
L380 | diagnostic·C | Subscription vs one-time — recurring revenue economics. | order type → recurring vs one-off LTV | 2°: treat sub like one-off / 3°: mis-value CAC | order type | M·H | CANDIDATE
L381 | alerting·C | Shopify-vs-ad revenue divergence — actual sales flat while ads claim growth. | Shopify total vs platform-attributed trend | 2°: attribution inflation / 3°: over-scale into nothing | connector | M·H | CANDIDATE
L382 | diagnostic·D | Fulfillment / shipping-cost drag — variable cost eating contribution. | ship cost per order vs contribution | 2°: free-ship offer kills margin / 3°: net loss | cost data | M·M | CANDIDATE
```

## 42. TRIPLE WHALE  (Phase 6, §56–60)  — engine: CANDIDATE

```
L383 | descriptive·B | TW blended metrics ingestion — pixel-based blended ROAS/MER/CAC. | TW API → blended metrics | 2°: TW model differs from platform / 3°: conflicting truth | connector | M·H | CANDIDATE
L384 | reconciliation·C | TW-vs-platform-vs-Shopify triangulation — three sources, one truth (§56–58). | TW vs Meta vs Shopify → diff + likely-reason + canonical | 2°: force agreement / 3°: pick nicer number (§130) | all soft | M·H | CANDIDATE
L385 | descriptive·B | TW attribution-model compare — first/last/linear side-by-side. | TW multi-model output → sensitivity | 2°: model shopping / 3°: cherry-pick ROAS | model access | M·H | CANDIDATE
L386 | diagnostic·C | TW new-customer / LTV overlay — enrich economics if Shopify thin. | TW customer analytics → nCAC/LTV | 2°: TW estimate treated as truth / 3°: overreach | estimate quality | M·M | CANDIDATE
L387 | reconciliation·C | Pixel-vs-API discrepancy — TW pixel vs platform API delta. | TW pixel vs API counts → gap | 2°: pixel gaps misread as performance / 3°: wrong call | pixel coverage | M·M | CANDIDATE
L388 | filtering·A | Source-precedence policy — which source wins for which metric (§57). | metric → canonical-source rule | 2°: inconsistent source use / 3°: contradictory reports | policy definition | M·H | CANDIDATE
```

## 43. CROSS-SOURCE RECONCILIATION  (§56–60, §128–130)  — engine: `lib/reconcile/*` (PARTIAL)

```
L389 | reconciliation·B | Source-diff record — capture diff/likely-reason/canonical/confidence (§56). | source A vs B → structured reconciliation record | 2°: silent pick of nicer number (§130) / 3°: trust loss | source access | M·H | PARTIAL
L390 | reconciliation·B | Semantic-first reconciliation — ask what each source MEASURES (§58). | metric definitions per source → semantic map before numbers | 2°: reconcile mismatched defs / 3°: false agreement | metadata | M·H | CANDIDATE
L391 | diagnostic·A | Metric-basis registry — gross/net, attribution, date, currency, tz, refund/tax per metric (§59). | metric → basis card | 2°: compare different bases / 3°: nonsense | basis capture | M·H | PARTIAL
L392 | alerting·B | Reconciliation-failure → HOLD — downgrade, never guess (§130). | irreconcilable sources → confidence haircut/HOLD | 2°: confident wrong number / 3°: bad decision | conflict detection | M·H | PARTIAL
L393 | diagnostic·C | Date-basis alignment — order-date vs report-date vs settlement-date. | per-source date basis → aligned window | 2°: window mismatch → false diff / 3°: chase ghost | basis data | M·M | CANDIDATE
L394 | diagnostic·C | Currency / FX normalization — multi-currency reconciliation. | FX rate + currency per row → common currency | 2°: FX drift misread as performance / 3°: false trend | FX source | M·M | CANDIDATE
L395 | scoring·C | Cross-source confidence — how much do independent sources agree (§142)? | agreement across sources → confidence lift/cut | 2°: agreement ≠ correctness (shared error) / 3°: false confidence | independence assumption | M·M | CANDIDATE
L396 | descriptive·B | Canonical-number selection audit — record why one number was chosen. | reconciliation → chosen value + rationale + version | 2°: unexplained choice / 3°: undebuggable | logging | M·M | CANDIDATE
```

## 44. AGENCY OPS  (§80–81, §11)  — engine: CANDIDATE (multi-tenant foundation EXISTS)

```
L397 | descriptive·A | Cross-account portfolio roll-up — all clients at a glance. | per-account health/risk → agency dashboard | 2°: aggregate hides sick clients / 3°: blind spot | tenancy scoping | M·H | CANDIDATE
L398 | ranking·B | Client-attention triage — which accounts need a human today? | health drop × risk × spend → attention rank | 2°: attention to loudest not costliest / 3°: churn a big client | scoring | M·H | CANDIDATE
L399 | alerting·B | Tenant-isolation guard — a rule ran on the wrong account (§80–81). | every output verifies org/brand/account/window | 2°: right formula, wrong account = still wrong / 3°: data leak | scope plumbing | M·H | EXISTS
L400 | descriptive·B | SLA / response tracking — are client issues handled in time? | alert→action latency by client | 2°: SLA breach unseen / 3°: client churn | action capture | M·M | CANDIDATE
L401 | descriptive·C | Workload / capacity per buyer — accounts-per-buyer vs complexity. | buyer load × account complexity → capacity flag | 2°: overloaded buyer misses issues / 3°: quality drop | complexity model | M·M | CANDIDATE
L402 | descriptive·B | Client-cohort benchmarking — compare a client to similar clients (§116–117). | peer set by industry/spend/model → relative position | 2°: unfair peer set / 3°: wrong narrative | peer definition | M·M | CANDIDATE
```

## 45. CLIENT REPORTING  (§120–127, §160)  — engine: `lib/cockpit/*` (PARTIAL), blog EXISTS

```
L403 | descriptive·B | WHAT/WHY/WHERE/HOW-MUCH/HOW-SURE/WHAT-NEXT report (§120). | engine outputs → structured client narrative | 2°: report without confidence/next-step / 3°: low trust | output completeness | M·H | PARTIAL
L404 | descriptive·A | Plain-English + show-calculation drill-down (§121–127). | summary→evidence→calc→raw source layering | 2°: black-box report / 3°: distrust | drill-down plumbing | M·H | PARTIAL
L405 | descriptive·B | Period-over-period client summary — what changed and why. | window deltas + causes → narrative | 2°: cherry-pick good window / 3°: misleading | window honesty | M·M | CANDIDATE
L406 | descriptive·C | Wins-and-risks digest — balanced view, not just wins. | top strengths + top risks → digest | 2°: hide risks to look good / 3°: surprise crisis | risk surfacing | M·M | CANDIDATE
L407 | descriptive·B | Confidence-colour labeling — every claim carries a confidence colour (§5, ledger). | claim confidence → 🟢/🟠/🔴 | 2°: false green erodes trust / 3°: bad decisions | calibration | L·H | PARTIAL
L408 | descriptive·D | Do-nothing-vs-act framing — cost of inaction vs action (§160). | recommendation → both branches quantified | 2°: one-sided advice / 3°: over-action | counterfactual estimate | M·M | CANDIDATE
```

## 46. FORECASTING  (§98, Phase 7)  — engine: CANDIDATE (fatigue-forecast EXISTS)

```
L409 | forecasting·C | Spend/revenue forecast — expected next-window outcome w/ interval (§98). | trend + seasonality → forecast + CI | 2°: false precision / 3°: over-budget | non-stationary | H·M | CANDIDATE
L410 | forecasting·C | Pacing-to-target — will we hit the month's spend/revenue goal? | MTD pace vs target → projection | 2°: linear pacing ignores weekend/BFCM / 3°: mis-manage | seasonality | M·H | CANDIDATE
L411 | forecasting·D | CPA/ROAS trajectory — where is efficiency heading? | robust trend → projected eff + CI | 2°: extrapolate noise / 3°: wrong plan | window | M·M | CANDIDATE
L412 | forecasting·D | Budget-scenario simulation — outcome under +/- X% spend. | elasticity → scenario outcomes | 2°: linear assumption / 3°: over-promise | elasticity | H·M | CANDIDATE
L413 | forecasting·D | Winner-decay forecast — when will current winners stop carrying? | half-life aggregate → portfolio decay curve | 2°: synchronized decay underestimated / 3°: cliff | HL estimates | M·H | CANDIDATE
L414 | forecasting·C | Demand-seasonality forecast — expected demand curve ahead. | seasonal model → demand path | 2°: thin history / 3°: mis-time budget | history depth | M·M | CANDIDATE
L415 | filtering·A | No-forecast-without-uncertainty gate (§98). | forecast → require CI or refuse | 2°: point estimate trusted as truth / 3°: bad bet | CI computation | L·H | CANDIDATE
L416 | forecasting·D | Cash-flow forecast — spend vs payback-timed revenue. | spend plan × payback → cash path | 2°: grow into liquidity crunch / 3°: insolvency | contribution timing | M·H | CANDIDATE
```

## 47. ANOMALY DETECTION  (§53, §54)  — engine: PARTIAL (change-analysis)

```
L417 | alerting·B | Metric anomaly — a value outside its own robust band. | robust z-score vs own history → anomaly | 2°: noise flagged / 3°: fatigue | band on thin data | M·H | PARTIAL
L418 | ranking·B | Anomaly prioritization by economic impact (§53). | anomaly × $ exposure × confidence → rank | 2°: chase trivial anomaly / 3°: miss costly one | impact estimate | M·H | PARTIAL
L419 | diagnostic·B | Anomaly-vs-seasonality — is the spike just the calendar? | deseasonalized residual → real anomaly | 2°: seasonal spike false-flagged / 3°: cry-wolf | seasonal model | M·H | CANDIDATE
L420 | diagnostic·C | Multivariate anomaly — several metrics off together (real event). | joint deviation → correlated anomaly | 2°: single-metric noise vs real event / 3°: mis-triage | correlation on thin data | M·M | CANDIDATE
L421 | diagnostic·B | Anomaly root-cause link — tie the anomaly to a change/source/market. | anomaly + change log + source health → cause | 2°: anomaly without cause = noise / 3°: no action | linkage | M·H | PARTIAL
L422 | alerting·A | Zero/negative/impossible-value anomaly — data-integrity alarm. | invariant violation (CTR>100%, neg spend) → alarm | 2°: garbage propagates downstream / 3°: nonsense outputs | invariant set | L·H | PARTIAL
L423 | diagnostic·C | Directional-anomaly context — good anomaly (spike up) vs bad (spike down). | anomaly sign × metric polarity → good/bad | 2°: alarm on a good spike / 3°: fatigue | polarity map | L·M | CANDIDATE
L424 | forecasting·D | Anomaly-persistence prediction — one-off blip vs new level. | post-anomaly trajectory → transient/persistent | 2°: over-react to a blip / 3°: churn | short window | M·M | CANDIDATE
```

## 48. OPPORTUNITY DETECTION  (§43, §47)  — engine: `lib/scoring/opportunity.ts`, `opportunityScore`

```
L425 | ranking·B | Opportunity score — where is unrealized upside (§47)? | winner headroom + whitespace + reallocation → ranked upside | 2°: over-promise recoverable $ / 3°: disappointment | headroom estimate | M·H | EXISTS
L426 | diagnostic·B | Under-funded-winner opportunity — scale-ready ads starved of budget. | high eff + headroom + capacity → opportunity | 2°: scale into saturation / 3°: no lift | headroom | M·H | EXISTS
L427 | diagnostic·C | Reallocation opportunity — $ movable from waste to winners. | trapped budget + winner headroom → move $ | 2°: learning-reset cost ignored / 3°: churn | reset cost | M·H | EXISTS
L428 | diagnostic·C | Whitespace opportunity — untested high-potential concept cells. | adjacent-winner perf × open cell → opportunity | 2°: extrapolation risk / 3°: waste | adjacency | M·H | PARTIAL
L429 | diagnostic·D | New-audience opportunity — adjacent lookalikes/interests to winners. | winner audience + adjacency → expansion candidate | 2°: overlap cannibalization / 3°: self-bid | overlap unknown | M·M | CANDIDATE
L430 | diagnostic·D | New-channel opportunity — where winning creative could travel. | winner concept × untried channel fit → opportunity | 2°: channel-fit mismatch / 3°: waste | channel data | M·M | CANDIDATE
L431 | diagnostic·C | Offer/price opportunity — untested offer that could lift contribution. | offer whitespace × margin → opportunity | 2°: offer hurts margin / 3°: net loss | margin data | M·M | CANDIDATE
L432 | ranking·D | Opportunity-vs-effort matrix — quick wins vs big bets. | upside × confidence ÷ effort → quadrant | 2°: chase big-bet, ignore quick win / 3°: slow value | effort estimate | M·M | CANDIDATE
```

## 49. EARLY WARNING  (§54)  — engine: PARTIAL (fatigue early-warning, status-stops)

```
L433 | predictive·B | Leading-indicator early warning — signal before the $ metric moves (§54). | leading signals (freq, hook-rate, CVR micro) → labelled prediction | 2°: labelled prediction not fact / 3°: cry-wolf | leading≠lagging here | M·H | PARTIAL
L434 | alerting·B | Winner-at-risk early warning — a spend-carrying winner starting to slip. | winner + early-fatigue signals → watch | 2°: premature refresh of a winner / 3°: lost momentum | early signal noise | M·H | PARTIAL
L435 | alerting·B | Budget-pacing early warning — on track to over/under-spend. | pace vs target trajectory → warn | 2°: linear pacing ignores cycles / 3°: mis-manage | seasonality | M·H | PARTIAL
L436 | alerting·C | CPM-creep early warning — inventory cost rising before CPA does. | CPM leading CPA → warn | 2°: market vs account confusion / 3°: wrong fix | index | M·M | CANDIDATE
L437 | alerting·C | Concentration-creep early warning — portfolio narrowing toward fragility. | diversity trend ↓ + concentration ↑ → warn | 2°: healthy pruning misread / 3°: keep losers | pruning vs risk | M·M | CANDIDATE
L438 | alerting·C | Margin-erosion early warning — contribution slipping while ROAS looks fine. | contribution trend ↓ vs ROAS flat → warn | 2°: ROAS masks margin (§66) / 3°: slow bleed | cost data | M·H | CANDIDATE
L439 | alerting·D | Tracking-degradation early warning — measurement getting less reliable. | modeled-share rising / CAPI health falling → warn | 2°: flying blind creeps in / 3°: bad calls | signal availability | M·M | CANDIDATE
L440 | alerting·D | Learning-instability early warning — too many changes, never settling. | change velocity vs settle-time → warn | 2°: self-inflicted volatility / 3°: no winners | settle estimate | M·M | CANDIDATE
```

---

## 50. CROSS-CUTTING TRUST & GATE LOGIC  (§90–99, §141–145)  — engine: `lib/rules/trust-gates.ts`, `lib/confidence.ts`, `lib/judgment/*`

These are the meta-rules that gate every domain above. Kept as a distinct section because they are
reused engines, not one-off diagnostics (§88 delete-before-adding: one gate serving many modules).

```
L441 | filtering·A | Materiality gate — no verdict on an entity below material spend share (corpus R0001). | entity spend vs parent (relative, tunable ~20%) → suppress verdict | 2°: metric swings on a sliver = noise / 3°: false kill | share threshold relative | L·H | EXISTS
L442 | filtering·A | Volume-sufficiency gate — no verdict below min conversions/clicks. | conversions vs min (relative) → judge/wait | 2°: conclude on thin data / 3°: false winner/loser | min relative (§92) | L·H | EXISTS
L443 | filtering·A | Minimum-runtime gate — no verdict before an entity has run long enough. | days-active vs min → judge/wait | 2°: kill in learning / 3°: reset loop | runtime relative | L·H | PARTIAL
L444 | filtering·A | Settled-window gate — only judge settled (attribution-mature) data. | window maturity vs conversion lag → settled/unsettled | 2°: judge unsettled data / 3°: premature (§8) | lag data | M·H | EXISTS
L445 | scoring·B | Agreement-based confidence — confidence rises when independent signals agree (§142). | # agreeing independent signals → confidence | 2°: shared-error signals faux-agree / 3°: false confidence | independence | M·H | EXISTS
L446 | diagnostic·B | Conflicting-signal handler — CTR↓ but CVR↑ → explain, don't auto-call (§143). | signal disagreement → explanation, not verdict | 2°: force a label / 3°: wrong action | signal parsing | M·H | PARTIAL
L447 | filtering·A | Rule-conflict resolver — priority/evidence/confidence/scope, explained (§141). | competing verdicts → resolved verdict + rationale | 2°: silent conflict resolution / 3°: distrust | priority model | M·H | PARTIAL
L448 | scoring·B | Confidence tiering — every output carries a confidence tier (§15, corpus). | evidence + sample + agreement → tier | 2°: uniform confidence hides risk / 3°: bad trust | inputs | M·H | EXISTS
L449 | filtering·A | Shrinkage / Bayesian gate — 1 sale @15x must not outrank 100 @5x (§20). | shrink estimate to cohort prior | 2°: back a fluke / 3°: waste | prior set | M·H | PARTIAL
L450 | descriptive·A | Freshness stamping — generated_at/data_as_of/valid_until on every output (§131). | output → time stamps + staleness | 2°: stale output looks current / 3°: wrong action | clock plumbing | L·H | PARTIAL
L451 | descriptive·A | Rule/formula/model/taxonomy versioning — reproducible outputs (§132). | version stamps on every result | 2°: can't reproduce history / 3°: undebuggable | version capture | M·M | PARTIAL
L452 | filtering·A | UNKNOWN / INSUFFICIENT-DATA emission — prefer honest unknown to false answer (§5). | data adequacy → UNKNOWN vs answer | 2°: confident wrong beats honest unknown / 3°: trust loss | adequacy calc | M·H | EXISTS
L453 | diagnostic·A | Invariant / property checks — CTR≤100%, counts≥0, spend≥0, ROAS defs (§78). | metric invariants → pass/violate | 2°: garbage propagates / 3°: nonsense | invariant set | L·H | PARTIAL
L454 | diagnostic·B | Simpson's-paradox guard — aggregate direction ≠ segment direction (§19). | segment vs aggregate sign check → warn | 2°: aggregate lies / 3°: wrong strategy | segmentation | M·M | CANDIDATE
L455 | diagnostic·B | Regression-to-mean guard — extreme early result likely reverts (§19). | extremeness × sample → revert warning | 2°: scale a lucky spike / 3°: reversion loss | sample | M·H | PARTIAL
L456 | diagnostic·C | Survivorship-bias guard — dead entities excluded from the view (§19). | included vs deleted/paused set → bias flag | 2°: "everything's healthy" (dead hidden) / 3°: false safety | state history | M·M | CANDIDATE
L457 | diagnostic·C | Multiple-comparisons guard — many tests inflate false positives (§19). | # comparisons → significance correction | 2°: false winner among many / 3°: waste | test count | M·M | CANDIDATE
L458 | scoring·D | Decision-quality feedback — learn from action+outcome, not approval (§113–115). | decision→outcome ledger → FP/FN + value | 2°: learn from clicks not results / 3°: bad model | outcome linkage | H·H | CANDIDATE
L459 | descriptive·B | UNKNOWN-library tracking — record what we cannot yet know (§106). | unanswerable questions → tracked gaps | 2°: pretend to know / 3°: false precision | discipline | L·M | CANDIDATE
L460 | filtering·A | Scope-safety assertion — user/org/brand/account/window verified per rule (§80). | scope tuple present & matched → allow | 2°: right calc wrong account / 3°: leak | plumbing | M·H | EXISTS
```

## 51. ADDITIONAL CANDIDATES (breadth to complete the 70-domain surface)

Rows below extend thin domains and add adjacent logics the charter implies (§44 hierarchy, §66 2nd/3rd-order,
§111 moat). All CANDIDATE unless noted.

```
L461 | diagnostic·C | Account-diagnostic-hierarchy router — DATA→HEALTH→ALLOCATION→CAMPAIGN→FUNNEL→PORTFOLIO→FATIGUE→DIVERSITY→SCALABILITY→NEXT (§44). | account state → correct diagnostic order | 2°: jump to ad-level without context / 3°: wrong fix | orchestration | M·H | PARTIAL
L462 | diagnostic·D | 2nd-order scale→stockout chain (§66). | scale plan × inventory → downstream stockout/refund risk | 2°: win the ad, lose the SKU / 3°: refunds+CS load | inventory data | M·H | CANDIDATE
L463 | diagnostic·D | 2nd-order cheap-acquisition→low-LTV chain (§66). | low nCAC × cohort LTV → masked-quality flag | 2°: cheap buyers churn / 3°: ROAS hides decay | LTV data | M·H | CANDIDATE
L464 | diagnostic·D | 3rd-order promo-dependence chain — discounting trains price-sensitive buyers. | promo frequency × repeat behavior | 2°: margin erodes structurally / 3°: brand devalue | promo+repeat data | M·M | CANDIDATE
L465 | diagnostic·C | Frequency-cap recommendation — cap before fatigue/waste sets in. | freq vs response-decay knee → cap suggestion | 2°: cap too low starves reach / 3°: no scale | knee estimate | M·M | CANDIDATE
L466 | diagnostic·C | Dayparting opportunity — hours/days with better efficiency. | hour/day CPA vs blended | 2°: uniform delivery wastes off-hours / 3°: CAC creep | intraday data | M·M | CANDIDATE
L467 | diagnostic·C | Geo-efficiency segmentation — regions worth more/less. | geo CPA/CVR vs blended | 2°: uniform bids waste on weak geos / 3°: CAC creep | geo data | M·M | CANDIDATE
L468 | diagnostic·C | Creative-length efficiency — optimal video length for this account. | duration bucket × hold/CVR | 2°: over-invest in long-form / 3°: waste | length metadata | M·M | CANDIDATE
L469 | diagnostic·D | UGC-vs-studio efficiency — content-style economics. | style tag × CPA × production cost | 2°: scale expensive style w/ low net / 3°: margin | style tag+cost | M·M | CANDIDATE
L470 | diagnostic·C | First-vs-third-party creator performance — creator-type economics. | creator type × performance | 2°: over-rely on one creator / 3°: dependence | creator tag | M·M | CANDIDATE
L471 | diagnostic·C | Landing-page-type fit — PDP vs advertorial vs quiz vs listicle. | LP type × CVR by traffic type | 2°: wrong LP for cold traffic / 3°: waste | LP typing | M·M | CANDIDATE
L472 | diagnostic·D | Post-purchase-flow leverage — upsell/subscription lifting LTV. | AOV/repeat lift from post-purchase | 2°: acquisition-only view undervalues CAC room / 3°: under-invest | post-purchase data | M·M | CANDIDATE
L473 | diagnostic·C | Creative-testing budget share — % of spend on unproven creative. | testing spend share vs own trailing | 2°: under-test → pipeline dries / 3°: cliff | phase tag | M·M | CANDIDATE
L474 | diagnostic·D | Auction-learning-reset cost model — $ lost per learning reset. | reset frequency × learning-phase cost → $ | 2°: over-editing costs invisibly / 3°: chronic drag | reset detection | M·M | CANDIDATE
L475 | diagnostic·C | Placement-CVR mismatch — placement drives clicks but not sales. | placement CTR vs CVR gap | 2°: pay for junk placement clicks / 3°: waste | placement breakdown | M·M | CANDIDATE
L476 | diagnostic·D | Brand-safety / policy-risk scan — creative at risk of disapproval. | creative attributes vs policy patterns → risk | 2°: sudden disapproval halts spend / 3°: lost day | pattern coverage | M·M | CANDIDATE
L477 | diagnostic·D | Comment-sentiment / social-proof signal — negative feedback on ads. | ad comment sentiment / hide-rate | 2°: negative feedback tanks delivery / 3°: CPM rise | comment data | M·L | CANDIDATE
L478 | descriptive·C | Negative-feedback-rate monitor — hides/reports vs baseline. | negative-feedback vs own norm | 2°: rising NFR precedes delivery loss / 3°: fatigue | NFR field | M·M | CANDIDATE
L479 | diagnostic·D | Creative-saturation-across-account — same asset over-served everywhere. | asset delivery breadth × freq | 2°: account-wide fatigue on one asset / 3°: cliff | delivery data | M·M | CANDIDATE
L480 | diagnostic·C | New-account cold-start protocol — how to reason with little history. | history depth → cold-start rule set + priors | 2°: mature rules on cold account / 3°: false alarms | history depth | M·H | CANDIDATE
L481 | diagnostic·C | Account-relative benchmark builder — construct the account's own baselines (§18). | trailing windows → per-metric baselines | 2°: hard-coded benchmark leaks in / 3°: §18 breach | window choice | M·H | PARTIAL
L482 | scoring·C | Peer-set construction — build a fair peer set by industry/spend/model (§117). | account attributes → peer cohort | 2°: wrong peers → wrong percentile / 3°: false narrative | peer attributes | M·M | CANDIDATE
L483 | scoring·C | Spend-weighted-baseline builder — weight baselines by delivery (§18). | metrics × spend weights → baseline | 2°: unweighted small ads distort / 3°: false norm | weighting | M·H | PARTIAL
L484 | diagnostic·D | EWMA / rolling-median trend engine — robust trend where justified (§144). | series → EWMA/median/slope w/ change-points | 2°: over-smoothing hides real break / 3°: late reaction | method choice | M·H | PARTIAL
L485 | diagnostic·D | Change-point detection — where did a series structurally shift? | robust change-point → shift dates | 2°: false shift on noise / 3°: wrong postmortem | window | M·M | PARTIAL
L486 | forecasting·D | Backtest harness — replay a rule on golden accounts before changing it (§76). | rule vs historical outcomes → backtest score | 2°: ship an unvalidated rule / 3°: regression | golden data | M·H | CANDIDATE
L487 | experimental·B | Shadow-run comparator — new formula beside old, compare, promote after review (§74–75). | old vs new outputs → diff report | 2°: silent formula swap / 3°: hidden regression | dual-run plumbing | M·H | PARTIAL
L488 | descriptive·A | Golden-decision fixtures — labelled expected conclusions (healthy/false-fatigue/etc.) (§77). | fixture set → regression gate | 2°: solve same edge twice (§73) / 3°: recurring bugs | fixture curation | M·H | CANDIDATE
L489 | diagnostic·C | Learning-phase-exit tracker — did the entity exit learning cleanly? | conversions-to-exit trajectory | 2°: judge/scale pre-exit / 3°: reset | status data | M·M | PARTIAL
L490 | diagnostic·D | Creative-concept lifecycle tracker — concept from launch→peak→decay→retire (§112). | concept state timeline → lifecycle stage | 2°: no lifecycle view → mistimed swaps / 3°: cliff | concept linkage | M·H | CANDIDATE
L491 | diagnostic·D | Portfolio-age distribution — spread of creative ages carrying spend. | age histogram of spend-weighted creatives | 2°: all old → synchronized decay / 3°: crash | age data | M·M | CANDIDATE
L492 | prescriptive·D | Kill-list generator — entities safe to pause now, with reasons + confidence. | loser gate + waste + fragility → ranked kill list | 2°: kill a starved winner / 3°: lose upside | gates upstream | M·H | PARTIAL
L493 | prescriptive·D | Scale-list generator — entities safe to scale now, with headroom + confidence. | scale readiness + headroom + capacity → ranked scale list | 2°: scale into saturation / 3°: no lift | headroom | M·H | PARTIAL
L494 | prescriptive·D | Daily action queue — the ranked "what to do today" across the account. | all prescriptive outputs → prioritized queue | 2°: too many actions → paralysis / 3°: nothing done | ranking | M·H | PARTIAL
L495 | descriptive·C | Do-nothing baseline — what happens if the buyer changes nothing (§160). | current trajectory → no-action projection | 2°: over-action bias / 3°: churn | trajectory est | M·M | CANDIDATE
L496 | diagnostic·D | Waste taxonomy — categorize waste (dormant/zombie/fatigued/mis-targeted/OOS). | waste sources → typed categories | 2°: one-size waste fix / 3°: wrong remedy | typing | M·M | PARTIAL
L497 | scoring·D | Economic-impact estimator — dollarize every finding (§53, §91). | finding × exposure × confidence → $ | 2°: over-state recoverable $ / 3°: disappointment | exposure model | M·H | PARTIAL
L498 | descriptive·B | Evidence-packet builder — deterministic packet the AI critic reasons over (§69). | engine outputs → structured evidence packet | 2°: packet gaps → weak critique / 3°: false confidence | packet schema | M·H | EXISTS
L499 | diagnostic·D | Root-cause tree — chain a symptom to its deepest cause (ponytail: cause not symptom). | symptom → cause chain w/ evidence | 2°: fix symptom, cause recurs / 3°: whack-a-mole | chain depth | M·H | CANDIDATE
L500 | descriptive·A | Traceability lineage — every number traces source→calc→decision (§5). | output → full lineage record | 2°: untraceable number / 3°: no trust/audit | lineage plumbing | M·H | PARTIAL
L501 | diagnostic·D | Cross-account learning transfer — patterns from one account priming another (§111 moat). | validated patterns → transferable priors (scope-tagged §140) | 2°: overfit one account onto another (§138) / 3°: wrong call | scope discipline | H·H | CANDIDATE
L502 | diagnostic·D | Category-vs-account context calibrator — don't underfit obvious category differences (§139). | account category → context adjustments | 2°: apply DTC-apparel logic to SaaS leads / 3°: wrong verdict | category tagging | M·M | CANDIDATE
L503 | descriptive·B | Rule-scope registry — every rule tagged global/category/brand/account (§140). | rule → scope tag | 2°: apply account rule globally / 3°: false universal | tagging discipline | L·H | CANDIDATE
L504 | scoring·D | FP/FN tracking per rule — measure each rule's error rates (§114). | rule verdicts vs outcomes → FP/FN | 2°: unmeasured rule drifts / 3°: silent harm | outcome labels | M·H | CANDIDATE
L505 | descriptive·C | Decision-value accounting — value created by acted-on recommendations (§115, §161). | acted recommendations × outcome → value | 2°: optimize features not value / 3°: wrong roadmap | attribution of value | M·H | CANDIDATE
```

---

## Per-domain candidate counts (rough)

| # | Domain | Rows | # | Domain | Rows |
|---|--------|------|---|--------|------|
| 1 | Account Health | 12 | 27 | CAC/nCAC/MER/ROAS/Contribution/LTV/Payback | 16 |
| 2 | Spend Allocation | 10 | 28 | Product & Offer Economics | 8 |
| 3 | Creative Performance | 12 | 29 | Inventory | 6 |
| 4 | Creative Fatigue | 14 | 30 | Refunds | 6 |
| 5 | Creative Diversity | 10 | 31 | Creative Production | 8 |
| 6 | Creative Half-Life | 8 | 32 | Competitor Intel | 10 |
| 7 | Creative Testing | 10 | 33 | Experiment Design | 8 |
| 8 | Creative Whitespace | 8 | 34 | Media Buyer Performance | 8 |
| 9 | Hook/Angle/Offer/Format/Audience | 14 | 35 | Change Impact | 10 |
| 10 | Funnel | 12 | 36 | Account Risk | 8 |
| 11 | Landing Page | 8 | 37 | Alerting | 8 |
| 12 | Conversion | 8 | 38 | AI Quality/Cost/Context/Hallucination | 12 |
| 13 | Budget Scaling | 12 | 39 | Cross-Channel | 8 |
| 14 | Campaign/Ad-set Structure | 12 | 40 | Google Ads | 10 |
| 15 | Objective | 6 | 41 | Shopify | 8 |
| 16 | Attribution | 10 | 42 | Triple Whale | 6 |
| 17 | Data Quality | 12 | 43 | Cross-Source Reconciliation | 8 |
| 18 | Meta Delivery | 10 | 44 | Agency Ops | 6 |
| 19 | Auction Dynamics | 8 | 45 | Client Reporting | 6 |
| 20 | Seasonality | 8 | 46 | Forecasting | 8 |
| 21 | Volatility | 6 | 47 | Anomaly Detection | 8 |
| 22 | Concentration | 6 | 48 | Opportunity Detection | 8 |
| 23 | Portfolio Fragility | 6 | 49 | Early Warning | 8 |
| 24 | Winner/Loser/Emerging | 12 | 50 | Cross-cutting Trust & Gates | 20 |
| 25 | Marginal Performance | 6 | 51 | Additional breadth candidates | 45 |
| 26 | Incrementality | 8 | | **TOTAL** | **505** |

Status split (from the STATUS column): **EXISTS = 77**, **PARTIAL = 151**, **CANDIDATE = 277**
(total 505). PARTIAL = corpus-only, demo-only, or one path built; the 1061-rule judgment corpus
(`lib/judgment/rules.json`) backs many fatigue/efficiency/scaling PARTIALs but is not the same as a
live engine. Roughly **228 of 505** logics have some code footprint today; **277 are net-new candidates**.

---

## Prioritization column (reserved — orchestrator fills, §101/§159)

For each row the orchestrator will compute and record:

```
P = (Economic-Impact × Frequency × Confidence × Actionability × Learning-Value) ÷ Impl-Cost
→ BUILD NOW | BUILD NEXT | SHADOW | RESEARCH | DEFER | REJECT
```

Guidance (not the decision): rows that are **EXISTS/PARTIAL + EV A/B + Value H** are natural
BUILD-NEXT hardening targets; **CANDIDATE + EV C/D** rows are SHADOW/RESEARCH until validated against
real account data (§15, §108); economic rows blocked only on a missing connector (Shopify/TW) are
DEFER-until-connected, not REJECT. **This inventory does not choose the build set** — it is the
discovery surface (§159).

### Ten highest-value CANDIDATE logics NOT yet built (orchestrator shortlist input)
Selected for Economic-Impact × Confidence × Actionability, independent of impl cost:

1. **L254 Contribution-margin ROAS** (§64) — turns "good ROAS" into "actually profitable"; blocks unprofitable scale. EV B.
2. **L262 Contribution-negative-spend alert** — flags spend that loses money after costs; direct $ save. EV B.
3. **L273/L274 Stockout-risk / OOS-ad alert** (§65) — stops spend on unbuyable SKUs and prevents scale-into-shortage. EV A/B.
4. **L279 Refund-adjusted ROAS** — removes the returns blind spot from every efficiency call. EV B.
5. **L253 nCAC (new-customer CAC)** (§62) — separates real acquisition from retargeting harvest. EV B.
6. **L163/L381 Platform-vs-Shopify attribution gap** (§56) — exposes attribution inflation before over-scaling. EV C→B once connected.
7. **L100/L101 Largest-meaningful-funnel-leak + cause classifier** (§46) — PARTIAL; hardening it stops "blame the ad for a checkout failure." EV B.
8. **L241 Geo-holdout incrementality** (§97) — the only way to know attributed ≠ incremental; high value, high cost. EV B.
9. **L257/L258 LTV:CAC + payback** — catches the "healthy ROAS, broken unit economics" slow death. EV B.
10. **L348 Hallucination detector** (§68) — guards every AI-surfaced claim; trust-critical as AI features grow. EV B.

_End of discovery inventory. Nothing here is a build commitment (§12, §159)._
